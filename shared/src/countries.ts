export interface Country {
  name: string;
  currency: string;
}

export const COUNTRIES = {
  US: { name: 'United States',  currency: 'USD' },
  IN: { name: 'India',           currency: 'INR' },
  GB: { name: 'United Kingdom',  currency: 'GBP' },
  DE: { name: 'Germany',         currency: 'EUR' },
  JP: { name: 'Japan',           currency: 'JPY' },
} as const satisfies Record<string, Country>;

export type CountryCode = keyof typeof COUNTRIES;
