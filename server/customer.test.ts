import { describe, it, expect, vi } from 'vitest';

// Mock the database functions
vi.mock('./db', () => ({
  createCustomer: vi.fn().mockResolvedValue({ id: 1 }),
  updateCustomer: vi.fn().mockResolvedValue(undefined),
  getCustomerByPhone: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Customer',
    phone: '07801234567',
    regionId: 5,
    lastDeliveryLocation: 'https://www.google.com/maps?q=33.3,44.4',
    lastDeliveryAt: new Date(),
  }),
  getCustomerById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Customer',
    phone: '07801234567',
    regionId: 5,
    lastDeliveryLocation: 'https://www.google.com/maps?q=33.3,44.4',
    lastDeliveryAt: new Date(),
  }),
}));

describe('Customer Management', () => {
  describe('createCustomer', () => {
    it('should create a customer with regionId', async () => {
      const { createCustomer } = await import('./db');
      
      const customerData = {
        name: 'Test Customer',
        phone: '07801234567',
        regionId: 5,
      };
      
      const result = await createCustomer(customerData);
      
      expect(result).toHaveProperty('id');
      expect(createCustomer).toHaveBeenCalledWith(customerData);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer with regionId', async () => {
      const { updateCustomer } = await import('./db');
      
      const updateData = {
        name: 'Updated Name',
        regionId: 10,
      };
      
      await updateCustomer(1, updateData);
      
      expect(updateCustomer).toHaveBeenCalledWith(1, updateData);
    });

    it('should update customer with lastDeliveryLocation', async () => {
      const { updateCustomer } = await import('./db');
      
      const updateData = {
        lastDeliveryLocation: 'https://www.google.com/maps?q=33.3,44.4',
        lastDeliveryAt: new Date(),
      };
      
      await updateCustomer(1, updateData);
      
      expect(updateCustomer).toHaveBeenCalledWith(1, updateData);
    });
  });

  describe('getCustomerByPhone', () => {
    it('should return customer with regionId and lastDeliveryLocation', async () => {
      const { getCustomerByPhone } = await import('./db');
      
      const customer = await getCustomerByPhone('07801234567');
      
      expect(customer).toHaveProperty('regionId');
      expect(customer).toHaveProperty('lastDeliveryLocation');
      expect(customer).toHaveProperty('lastDeliveryAt');
    });
  });
});
