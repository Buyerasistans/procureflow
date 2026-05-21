import React from 'react';
import './DiscoveryLabOperationsTab.css';

export interface DiscoveryLabOperationsTabProps extends React.ComponentPropsWithoutRef<'section'> {}

const DiscoveryLabOperationsTab = React.forwardRef<HTMLElement, DiscoveryLabOperationsTabProps>(
  ({ className, children, ...rest }, ref) => {
    const classes = ['discovery-lab-operations-tab', className].filter(Boolean).join(' ');

    return (
      <section ref={ref} className={classes} {...rest}>
        {children}
      </section>
    );
  }
);

DiscoveryLabOperationsTab.displayName = 'DiscoveryLabOperationsTab';

export default DiscoveryLabOperationsTab;