#!/bin/bash
# Create simple colored icons for PWA
convert -size 192x192 xc:'#10b981' -gravity center -pointsize 80 -fill white -annotate +0+0 'صيدلية\nجونيا' icon-192.png 2>/dev/null || echo "ImageMagick not available, using placeholder"
convert -size 512x512 xc:'#10b981' -gravity center -pointsize 200 -fill white -annotate +0+0 'صيدلية\nجونيا' icon-512.png 2>/dev/null || echo "ImageMagick not available, using placeholder"
