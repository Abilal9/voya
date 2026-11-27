import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'voya:isPublic';

/**
 * Opts a controller or route out of the global auth guard. Every route
 * requires a verified Supabase session unless it says otherwise here.
 */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC, true);
