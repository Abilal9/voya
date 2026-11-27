import { Injectable } from '@nestjs/common';
import type { Place as PlaceRow, Prisma } from '@prisma/client';
import type { ListPlacesQuery, Place, PlacesPage } from '@voya/contracts';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stable order (name, then id) with an opaque cursor. */
  async list(query: ListPlacesQuery): Promise<PlacesPage> {
    const where: Prisma.PlaceWhereInput = {
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;
    const rows = await this.prisma.place.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return { items: page.map(toPlace), nextCursor: hasMore && last ? encodeCursor(last.id) : null };
  }

  async get(id: string): Promise<Place> {
    if (!UUID.test(id)) throw AppError.notFound('This place');
    const row = await this.prisma.place.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('This place');
    return toPlace(row);
  }
}

export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!UUID.test(id)) {
    throw new AppError('validation_failed', 'Some of the details are not valid.', [
      { path: 'query.cursor', message: 'Invalid cursor' },
    ]);
  }
  return id;
}

/**
 * Row → contract. NULL columns become ABSENT fields, never 0/false/"":
 * the app renders "No rating yet" and "Hours unknown" from absence.
 */
export function toPlace(row: PlaceRow): Place {
  const place: Place = { id: row.id, name: row.name, category: row.category, city: row.city };
  if (row.type !== null) place.type = row.type;
  if (row.area !== null) place.area = row.area;
  if (row.rating !== null) place.rating = row.rating;
  if (row.price !== null) place.price = row.price;
  if (row.photo !== null) place.photo = row.photo;
  if (row.reason !== null) place.reason = row.reason;
  if (row.description !== null) place.description = row.description;
  if (row.hoursText !== null) place.hoursText = row.hoursText;
  if (row.latitude !== null && row.longitude !== null) {
    place.coordinates = { latitude: row.latitude, longitude: row.longitude };
  }
  if (row.openNow !== null) place.openNow = row.openNow;
  if (row.permanentlyClosed !== null) place.permanentlyClosed = row.permanentlyClosed;
  if (row.tags.length > 0) place.tags = row.tags;
  return place;
}
