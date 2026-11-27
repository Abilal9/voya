import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { ValidationIssue } from '@voya/contracts';
import type { ZodError, ZodTypeAny, z } from 'zod';
import { AppError } from '../errors/app-error';

/** A DTO class carrying a Zod schema from @voya/contracts. */
export interface ZodDto<S extends ZodTypeAny = ZodTypeAny> {
  new (): z.infer<S>;
  readonly schema: S;
}

/**
 * Declares a request DTO from a shared schema, so controllers get typed,
 * validated input without a second (class-validator) definition:
 *
 *   class ListPlacesQueryDto extends zodDto(ListPlacesQuerySchema) {}
 *   list(@Query() query: ListPlacesQueryDto)
 */
export function zodDto<S extends ZodTypeAny>(schema: S): ZodDto<S> {
  class Dto {
    static readonly schema = schema;
  }
  return Dto as unknown as ZodDto<S>;
}

export function toIssues(error: ZodError, prefix: string): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path].join('.'),
    message: issue.message,
  }));
}

/**
 * Global pipe: any @Body/@Query/@Param typed with a `zodDto` is parsed (and
 * coerced/defaulted) by its schema. Failures become a 422 `validation_failed`
 * listing each bad field. Unknown keys are stripped by Zod's default.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = (metadata.metatype as Partial<ZodDto> | undefined)?.schema;
    if (!schema || metadata.type === 'custom') return value;
    const result = schema.safeParse(value ?? {});
    if (!result.success) {
      throw new AppError('validation_failed', 'Some of the details are not valid.', toIssues(result.error, metadata.type));
    }
    return result.data;
  }
}
