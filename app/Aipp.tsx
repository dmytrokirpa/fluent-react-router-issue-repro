import * as React from 'react';
import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Button,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';

export const Overlay = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div>
      <OverlayDrawer
        as="aside"
        open={isOpen}
        onOpenChange={(_, { open }) => setIsOpen(open)}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close"
                icon={<Dismiss24Regular />}
                onClick={() => setIsOpen(false)}
              />
            }
          >
            Overlay Drawer
          </DrawerHeaderTitle>
        </DrawerHeader>

        <DrawerBody>
          <p>Drawer content</p>
        </DrawerBody>
      </OverlayDrawer>

      <Button appearance="primary" onClick={() => setIsOpen(true)}>
        Open Drawer
      </Button>
    </div>
  );
};

export default Overlay;
