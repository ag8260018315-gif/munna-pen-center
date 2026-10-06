/**
 * Field length limits shared by the HTML forms (`maxLength`) and the server-side schema.
 * Kept in its own dependency-free module so client components can import it without pulling
 * the validation library (zod) into the browser bundle.
 */
export const LIMITS = {
  name: 100,
  organization: 150,
  email: 254,
  city: 80,
  productsRequired: 2000,
  approximateQuantity: 200,
  additionalRequirements: 2000,
  itemQuantity: 100,
  contactMessage: 2000,
  maxItems: 50,
} as const;
