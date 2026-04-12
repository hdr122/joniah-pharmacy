import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin } from 'lucide-react';

interface WazeMapProps {
  locations: Array<{
    latitude: string;
    longitude: string;
    deliveryPersonName?: string;
    status?: string;
    activeOrders?: number;
    timestamp?: Date;
  }>;
  routes?: Array<{
    deliveryPersonId: number;
    deliveryPersonName: string;
    path: Array<{ lat: number; lng: number }>;
  }>;
  className?: string;
  showLivePreview?: boolean; // New prop for live preview mode
}

export default function WazeMap({ locations, routes, className = '', showLivePreview = false }: WazeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<number>(0);

  // If showLivePreview is true, show iframe with first location
  if (showLivePreview && locations && locations.length > 0) {
    const lat = parseFloat(locations[selectedLocation]?.latitude || locations[0].latitude);
    const lng = parseFloat(locations[selectedLocation]?.longitude || locations[0].longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
      return (
        <div className={className} style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
          {/* Location Selector */}
          {locations.length > 1 && (
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              zIndex: 10,
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              backgroundColor: 'white',
              padding: '12px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {locations.map((loc, idx) => (
                <Button
                  key={idx}
                  variant={selectedLocation === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLocation(idx)}
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-3 w-3" />
                  {loc.deliveryPersonName || `مندوب ${idx + 1}`}
                </Button>
              ))}
            </div>
          )}

          {/* Waze Live Preview iframe */}
          <iframe
            src={`https://embed.waze.com/iframe?zoom=15&lat=${lat}&lon=${lng}&pin=1`}
            width="100%"
            height="100%"
            style={{
              border: 'none',
              borderRadius: '8px',
              minHeight: '500px',
            }}
            title="Waze Live Map"
            allowFullScreen
          />

          {/* Open in Waze App Button */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 10,
          }}>
            <Button
              asChild
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
            >
              <a
                href={`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=17`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                فتح في تطبيق Waze
              </a>
            </Button>
          </div>
        </div>
      );
    }
  }

  // Original card-based view
  useEffect(() => {
    if (!mapContainerRef.current || !locations || locations.length === 0) return;

    // Calculate center from first location
    const centerLat = parseFloat(locations[0].latitude);
    const centerLng = parseFloat(locations[0].longitude);

    // Clear container
    mapContainerRef.current.innerHTML = '';

    // Create container for markers
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = '#f5f5f5';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';

    // Create Waze-style background
    const background = document.createElement('div');
    background.style.position = 'absolute';
    background.style.top = '0';
    background.style.left = '0';
    background.style.width = '100%';
    background.style.height = '100%';
    background.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    background.style.opacity = '0.1';
    container.appendChild(background);

    // Create header with Waze branding
    const header = document.createElement('div');
    header.style.position = 'absolute';
    header.style.top = '20px';
    header.style.left = '20px';
    header.style.right = '20px';
    header.style.padding = '16px';
    header.style.backgroundColor = 'white';
    header.style.borderRadius = '12px';
    header.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    header.style.zIndex = '10';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#667eea"/>
        </svg>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">Waze Live Tracking</h3>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">تتبع مباشر للمندوبين</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <span style="padding: 4px 12px; background: #10b981; color: white; border-radius: 16px; font-size: 12px; font-weight: 600;">
          ${locations.length} مندوب نشط
        </span>
        ${routes ? `<span style="padding: 4px 12px; background: #3b82f6; color: white; border-radius: 16px; font-size: 12px; font-weight: 600;">
          ${routes.length} مسار
        </span>` : ''}
      </div>
    `;
    container.appendChild(header);

    // Create markers container
    const markersContainer = document.createElement('div');
    markersContainer.style.position = 'absolute';
    markersContainer.style.top = '50%';
    markersContainer.style.left = '50%';
    markersContainer.style.transform = 'translate(-50%, -50%)';
    markersContainer.style.display = 'flex';
    markersContainer.style.flexWrap = 'wrap';
    markersContainer.style.gap = '20px';
    markersContainer.style.padding = '140px 20px 20px 20px';
    markersContainer.style.maxWidth = '100%';
    markersContainer.style.maxHeight = '100%';
    markersContainer.style.overflowY = 'auto';
    markersContainer.style.justifyContent = 'center';

    // Add markers for each location
    locations.forEach((location, index) => {
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      const statusColor = location.status === 'online' ? '#10b981' :
                         location.status === 'recent' ? '#f59e0b' :
                         '#6b7280';

      const marker = document.createElement('div');
      marker.style.display = 'flex';
      marker.style.flexDirection = 'column';
      marker.style.alignItems = 'center';
      marker.style.gap = '8px';
      marker.style.padding = '16px';
      marker.style.backgroundColor = 'white';
      marker.style.borderRadius = '16px';
      marker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      marker.style.cursor = 'pointer';
      marker.style.transition = 'all 0.3s ease';
      marker.style.minWidth = '200px';

      marker.innerHTML = `
        <div style="position: relative;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: ${statusColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          ${location.status === 'online' ? `
            <div style="position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: #10b981; border: 3px solid white; border-radius: 50%; animation: pulse 2s infinite;"></div>
          ` : ''}
        </div>
        <div style="text-align: center;">
          <div style="font-weight: bold; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
            ${location.deliveryPersonName || 'مندوب ' + (index + 1)}
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">
            ${location.status === 'online' ? '🟢 متصل الآن' : location.status === 'recent' ? '🟡 متصل مؤخراً' : '⚪ غير متصل'}
          </div>
          ${location.activeOrders ? `
            <div style="font-size: 11px; color: #3b82f6; font-weight: 600;">
              📦 ${location.activeOrders} طلب نشط
            </div>
          ` : ''}
          ${location.timestamp ? `
            <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">
              ${new Date(location.timestamp).toLocaleTimeString('ar-IQ')}
            </div>
          ` : ''}
        </div>
        <a 
          href="https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=17" 
          target="_blank"
          rel="noopener noreferrer"
          style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 600; transition: all 0.3s ease;"
          onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.4)';"
          onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          فتح في Waze
        </a>
      `;

      marker.addEventListener('mouseenter', () => {
        marker.style.transform = 'translateY(-4px)';
        marker.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.transform = 'translateY(0)';
        marker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });

      markersContainer.appendChild(marker);
    });

    container.appendChild(markersContainer);

    // Add CSS animation for pulse effect
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(1.1);
        }
      }
    `;
    document.head.appendChild(style);

    mapContainerRef.current.appendChild(container);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, [locations, routes]);

  return (
    <div ref={mapContainerRef} className={className} style={{ width: '100%', height: '100%', minHeight: '500px' }} />
  );
}
