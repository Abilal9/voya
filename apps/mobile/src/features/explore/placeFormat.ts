import type { Place } from '@/services';

/** Today's hours line. Unknown hours are "Hours unknown", which is not "closed". */
export function hoursLine(place: Place) {
  if (place.permanentlyClosed) return 'Permanently closed';
  if (place.hoursText) return place.hoursText;
  if (place.openNow === true) return 'Open now';
  if (place.openNow === false) return 'Closed now';
  return 'Hours unknown';
}
