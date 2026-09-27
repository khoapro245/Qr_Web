import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * A resolver for forms whose inputs are plain strings/booleans (as HTML controls produce)
 * validated by a shared schema that parses those strings into typed output.
 * The shared schemas accept these string forms explicitly; the cast only bridges the
 * schema's declared input type to the form's field-value type.
 */
export function formResolver<TValues extends FieldValues, TSchema extends z.ZodType>(
  schema: TSchema,
): Resolver<TValues, unknown, z.output<TSchema>> {
  return zodResolver(schema as never) as unknown as Resolver<TValues, unknown, z.output<TSchema>>;
}
