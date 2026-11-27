import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListPlacesQuerySchema, type Place, type PlacesPage } from '@voya/contracts';
import { Public } from '../auth/public.decorator';
import { zodDto } from '../common/validation/zod';
import { PlacesService } from './places.service';

class ListPlacesQueryDto extends zodDto(ListPlacesQuerySchema) {}

/**
 * Read-only catalogue (B0 vertical slice). Public for now: it is the seeded
 * fixture catalogue. Becomes authenticated and rate-limited when real
 * provider data (and its cost) arrives.
 */
@Public()
@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  list(@Query() query: ListPlacesQueryDto): Promise<PlacesPage> {
    return this.places.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Place> {
    return this.places.get(id);
  }
}
