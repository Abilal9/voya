import * as React from 'react';
import { services as defaultServices } from './index';
import type { Services } from './contracts';

const ServicesContext = React.createContext<Services>(defaultServices);

export function ServicesProvider({
  children,
  value = defaultServices,
}: {
  children: React.ReactNode;
  value?: Services;
}) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

/** Screens consume services through this hook — never by importing mocks. */
export function useServices(): Services {
  return React.useContext(ServicesContext);
}
