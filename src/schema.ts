export type Field = { type: 'string' | 'integer' | 'boolean'; nullable?: boolean; min?: number; max?: number; values?: string[]; reference?: string; email?: boolean; url?: boolean };
export type Resource = { fields: Record<string, Field>; created: string; filters: string[] };
const text: Field = { type: 'string' };
const optionalText: Field = { type: 'string', nullable: true };
const reference = (table: string): Field => ({ type: 'integer', min: 1, reference: table });
export const resources: Record<string, Resource> = {
  shops: { created: 'createdAt', filters: ['ownerId'], fields: {
    ownerId: reference('users'), shopName: text, description: optionalText, city: text,
    shopTier: { type: 'string', values: ['bronze', 'silver', 'gold'] }, avatarUrl: { ...optionalText, url: true }
  } },
  products: { created: 'createdAt', filters: ['shopId'], fields: {
    shopId: reference('shops'), productName: text, description: optionalText,
    price: { type: 'integer', min: 0 }, stockCount: { type: 'integer', min: 0 },
    imageUrl: { ...optionalText, url: true }, avatarUrl: { ...optionalText, url: true }, isAvailable: { type: 'boolean' }
  } },
  reviews: { created: 'created_at', filters: ['product_id', 'user_id'], fields: {
    product_id: reference('products'), user_id: reference('users'),
    rating: { type: 'integer', min: 1, max: 5 }, review_text: text, avatar_url: { ...optionalText, url: true }
  } },
  users: { created: 'created_at', filters: [], fields: {
    full_name: text, email: { ...text, email: true }, avatar_url: { ...optionalText, url: true }
  } }
};
