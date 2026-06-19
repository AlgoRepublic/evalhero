export const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const formatFullTime = (date: Date) => {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric', 
      minute: '2-digit' 
    });
  }
};

export const formatDateSeparator = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const isSameDay = (date1: Date, date2: Date) => {
  return date1.toDateString() === date2.toDateString();
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Color generation utilities for chat avatars
// Generate a unique, infinite color for each sender based on their ID
// Colors are generated dynamically to avoid repetition and support unlimited senders
// Green and red colors are excluded to avoid confusion with approval/rejection states

/**
 * Adjust color for dark mode to ensure good contrast and visibility
 * In dark mode, slightly increases saturation and brightness for better visibility
 */
export const adjustColorForDarkMode = (r: number, g: number, b: number): string => {
  // Calculate brightness (using relative luminance formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // For dark mode, slightly brighten colors to improve visibility against dark backgrounds
  // But keep them dark enough that white text remains readable
  if (brightness < 120) {
    // Increase brightness by 15-25% but ensure it stays below 200 for white text readability
    const factor = 1.15 + (120 - brightness) / 120 * 0.1; // Scale factor based on darkness
    const newR = Math.min(200, Math.round(r * factor));
    const newG = Math.min(200, Math.round(g * factor));
    const newB = Math.min(200, Math.round(b * factor));
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  
  // Colors that are already bright enough don't need adjustment
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Generate a consistent, unique color for a sender based on their ID
 * Uses HSL color space to ensure vibrant, distinct colors
 * Avoids green (hue 120-180) and red (hue 0-30, 330-360) ranges
 * 
 * @param senderId - The unique ID of the sender
 * @param senderName - Optional name of the sender (used as fallback)
 * @param isDark - Whether dark mode is enabled
 * @returns Hex color string (e.g., '#1890ff')
 */
export const getSenderColor = (senderId: string, senderName?: string, isDark?: boolean): string => {
  // Use senderId if available, otherwise fallback to senderName
  const identifier = senderId || senderName || 'unknown';
  
  // Generate a hash from the identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to generate HSL values
  // Hue: 0-360, but strictly exclude ALL greenish colors (60-200) and red (0-30, 330-360)
  // Valid ranges: 30-60 (orange to yellow, avoiding yellow-green) and 200-325 (cyan-blue to magenta, avoiding cyan-green and red)
  // This ensures no greenish or reddish colors are generated
  const hueRange1 = 30; // 30-60 (orange to yellow, no yellow-green)
  const hueRange2 = 125; // 200-325 (cyan-blue to magenta, no cyan-green, no red)
  const totalRange = hueRange1 + hueRange2; // 155 degrees total
  
  let hue = Math.abs(hash) % totalRange;
  if (hue < hueRange1) {
    hue = hue + 30; // Map to 30-60 range (orange to yellow)
  } else {
    hue = hue - hueRange1 + 200; // Map to 200-325 range (cyan-blue to magenta)
  }
  
  // Safety check: ensure we never generate greenish (60-200) or red (0-30, 330-360)
  // This should never happen with the above logic, but adding extra protection
  if ((hue >= 60 && hue <= 200) || (hue >= 0 && hue <= 30) || (hue >= 330 && hue <= 360)) {
    // Fallback: shift to safe range
    if (hue >= 60 && hue <= 200) {
      // Shift greenish colors to safe ranges
      if (hue < 130) {
        hue = 55; // Shift to yellow (not yellow-green)
      } else {
        hue = 205; // Shift to cyan-blue (not cyan-green)
      }
    } else if (hue >= 0 && hue <= 30) {
      hue = 35; // Shift red to orange
    } else if (hue >= 330 && hue <= 360) {
      hue = 325; // Shift red to magenta
    }
  }
  
  // Saturation: 60-85% for vibrant but not overwhelming colors
  const saturation = 60 + (Math.abs(hash >> 8) % 26); // 60-85%
  
  // Lightness: 40-50% for good contrast with white text
  const lightness = 40 + (Math.abs(hash >> 16) % 11); // 40-50%
  
  // Convert HSL to RGB
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  // Adjust for dark mode if needed
  return isDark ? adjustColorForDarkMode(r, g, b) : `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

