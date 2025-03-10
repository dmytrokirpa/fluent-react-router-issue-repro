// 1. Import required Fluent UI SSR utilities
import {
  createDOMRenderer,
  RendererProvider,
  renderToStyleElements,
  SSRProvider,
} from '@fluentui/react-components';

import { PassThrough } from 'node:stream';

import type { AppLoadContext, EntryContext } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';

export const streamTimeout = 5_000;

// 2. Define constants for style injection
const FLUENT_UI_INSERTION_POINT_TAG = `<meta name="fluentui-insertion-point" content="fluentui-insertion-point"/>`;
const FLUENT_UI_INSERTION_TAG_REGEX = new RegExp(
  FLUENT_UI_INSERTION_POINT_TAG.replaceAll(' ', '(\\s)*')
);

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext
  // If you have middleware enabled:
  // loadContext: unstable_RouterContextProvider
) {
  // 3. Create Fluent UI renderer
  const renderer = createDOMRenderer();

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    // 4. Track style extraction state
    let isStyleExtracted = false;
    let userAgent = request.headers.get('user-agent');

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    let readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? 'onAllReady'
        : 'onShellReady';

    const { pipe, abort } = renderToPipeableStream(
      // 5. Wrap RemixServer with Fluent UI providers
      <RendererProvider renderer={renderer}>
        <SSRProvider>
          <ServerRouter context={routerContext} url={request.url} />
          {/* or <RemixServer context={remixContext} url={request.url} /> */}
        </SSRProvider>
      </RendererProvider>,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            // 6. Transform stream to inject Fluent UI styles
            transform(chunk, _, callback) {
              const str = chunk.toString();
              const style = renderToStaticMarkup(
                <>{renderToStyleElements(renderer)}</>
              );

              if (
                !isStyleExtracted &&
                FLUENT_UI_INSERTION_TAG_REGEX.test(str)
              ) {
                chunk = str.replace(
                  FLUENT_UI_INSERTION_TAG_REGEX,
                  `${FLUENT_UI_INSERTION_POINT_TAG}${style}`
                );
                isStyleExtracted = true;
              }

              callback(null, chunk);
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    setTimeout(abort, streamTimeout + 1000);
  });
}
