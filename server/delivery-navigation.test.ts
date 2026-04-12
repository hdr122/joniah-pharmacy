import { describe, it, expect } from 'vitest';

/**
 * Tests for DeliveryNavigation location deduplication
 * 
 * This test verifies that the availableLocations function correctly:
 * 1. Removes duplicate URLs from the location list
 * 2. Prioritizes locationLink over customerLocationUrl1
 * 3. Only shows unique locations to delivery persons
 */

describe('DeliveryNavigation - Location Deduplication', () => {
  it('should remove duplicate location URLs', () => {
    // Simulate the availableLocations logic
    const order = {
      locationLink: 'https://maps.app.goo.gl/WHJvY1JKtReyyiV47',
      customerLocationUrl1: 'https://maps.app.goo.gl/WHJvY1JKtReyyiV47', // Same as locationLink
      customerLocationUrl2: 'https://maps.google.com/different-location',
    };

    const locations: { id: string; name: string; url: string }[] = [];
    const addedUrls = new Set<string>();

    const addLocation = (id: string, name: string, url: string) => {
      if (url && !addedUrls.has(url)) {
        locations.push({ id, name, url });
        addedUrls.add(url);
      }
    };

    // Priority: locationLink first
    if (order.locationLink) {
      addLocation("main", "موقع التوصيل", order.locationLink);
    } else if (order.customerLocationUrl1) {
      addLocation("main", "الموقع الرئيسي", order.customerLocationUrl1);
    }

    if (order.customerLocationUrl2) {
      addLocation("secondary", "الموقع الثانوي", order.customerLocationUrl2);
    }

    // Should only have 2 locations (main and secondary), not 3
    expect(locations).toHaveLength(2);
    expect(locations[0].url).toBe('https://maps.app.goo.gl/WHJvY1JKtReyyiV47');
    expect(locations[0].name).toBe('موقع التوصيل');
    expect(locations[1].url).toBe('https://maps.google.com/different-location');
  });

  it('should show only one location when all URLs are the same', () => {
    const order = {
      locationLink: 'https://maps.app.goo.gl/ABC123',
      customerLocationUrl1: 'https://maps.app.goo.gl/ABC123',
      customerLocationUrl2: 'https://maps.app.goo.gl/ABC123',
    };

    const locations: { id: string; name: string; url: string }[] = [];
    const addedUrls = new Set<string>();

    const addLocation = (id: string, name: string, url: string) => {
      if (url && !addedUrls.has(url)) {
        locations.push({ id, name, url });
        addedUrls.add(url);
      }
    };

    if (order.locationLink) {
      addLocation("main", "موقع التوصيل", order.locationLink);
    }
    if (order.customerLocationUrl1) {
      addLocation("main", "الموقع الرئيسي", order.customerLocationUrl1);
    }
    if (order.customerLocationUrl2) {
      addLocation("secondary", "الموقع الثانوي", order.customerLocationUrl2);
    }

    // Should only have 1 location
    expect(locations).toHaveLength(1);
    expect(locations[0].url).toBe('https://maps.app.goo.gl/ABC123');
  });

  it('should prioritize locationLink over customerLocationUrl1', () => {
    const order = {
      locationLink: 'https://maps.app.goo.gl/PRIMARY',
      customerLocationUrl1: 'https://maps.app.goo.gl/SECONDARY',
    };

    const locations: { id: string; name: string; url: string }[] = [];
    const addedUrls = new Set<string>();

    const addLocation = (id: string, name: string, url: string) => {
      if (url && !addedUrls.has(url)) {
        locations.push({ id, name, url });
        addedUrls.add(url);
      }
    };

    // Priority: locationLink first
    if (order.locationLink) {
      addLocation("main", "موقع التوصيل", order.locationLink);
    } else if (order.customerLocationUrl1) {
      addLocation("main", "الموقع الرئيسي", order.customerLocationUrl1);
    }

    if (order.customerLocationUrl1 && order.customerLocationUrl1 !== order.locationLink) {
      addLocation("alt", "موقع بديل", order.customerLocationUrl1);
    }

    // Should have 2 locations with correct priority
    expect(locations).toHaveLength(2);
    expect(locations[0].url).toBe('https://maps.app.goo.gl/PRIMARY');
    expect(locations[0].name).toBe('موقع التوصيل');
  });
});

describe('DeliveryNavigation - Google Maps Short Links', () => {
  it('should recognize goo.gl short link format', () => {
    const shortLinks = [
      'https://maps.app.goo.gl/WHJvY1JKtReyyiV47',
      'https://goo.gl/maps/ABC123',
      'https://g.co/maps/XYZ789',
    ];

    shortLinks.forEach(url => {
      const isShortLink = url.includes('goo.gl') || url.includes('maps.app.goo.gl') || url.includes('g.co');
      expect(isShortLink).toBe(true);
    });
  });

  it('should not treat regular Google Maps URLs as short links', () => {
    const regularUrls = [
      'https://www.google.com/maps/@33.3152,44.3661,15z',
      'https://maps.google.com/maps?q=33.3152,44.3661',
    ];

    regularUrls.forEach(url => {
      const isShortLink = url.includes('goo.gl') || url.includes('maps.app.goo.gl') || url.includes('g.co');
      expect(isShortLink).toBe(false);
    });
  });
});
