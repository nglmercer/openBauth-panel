import { z } from 'zod';

/**
 * Convierte un JSON Schema básico a un Zod schema
 * Esta es una implementación simplificada que maneja los casos más comunes
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodSchema {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.any();
  }

  // Handle $ref references (basic implementation)
  if (jsonSchema.$ref) {
    return z.any(); // For now, return any for references
  }

  // Handle anyOf/oneOf/allOf
  if (jsonSchema.anyOf && Array.isArray(jsonSchema.anyOf)) {
    const schemas = jsonSchema.anyOf.map((schema: any) => jsonSchemaToZod(schema));
    return z.union(schemas);
  }

  if (jsonSchema.oneOf && Array.isArray(jsonSchema.oneOf)) {
    const schemas = jsonSchema.oneOf.map((schema: any) => jsonSchemaToZod(schema));
    return z.union(schemas);
  }

  if (jsonSchema.allOf && Array.isArray(jsonSchema.allOf)) {
    // For allOf, we'll merge the schemas (simplified approach)
    let mergedSchema = z.object({});
    for (const schema of jsonSchema.allOf) {
      const subSchema = jsonSchemaToZod(schema);
      if (subSchema instanceof z.ZodObject) {
        mergedSchema = mergedSchema.merge(subSchema);
      }
    }
    return mergedSchema;
  }

  // Handle basic types
  switch (jsonSchema.type) {
    case 'string':
      let stringSchema = z.string();
      
      // Handle format
      if (jsonSchema.format) {
        switch (jsonSchema.format) {
          case 'email':
            stringSchema = stringSchema.email();
            break;
          case 'uuid':
            stringSchema = stringSchema.uuid();
            break;
          case 'uri':
          case 'url':
            stringSchema = stringSchema.url();
            break;
          case 'date-time':
            stringSchema = stringSchema.datetime();
            break;
          case 'date':
            stringSchema = stringSchema.date();
            break;
          case 'time':
            stringSchema = stringSchema.time();
            break;
          case 'ipv4':
            // Use regex pattern for IPv4 since ip() method might not be available
            stringSchema = stringSchema.regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
            break;
          case 'ipv6':
            // Use regex pattern for IPv6 since ip() method might not be available
            stringSchema = stringSchema.regex(/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/);
            break;
        }
      }

      // Handle pattern
      if (jsonSchema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(jsonSchema.pattern));
      }

      // Handle minLength/maxLength
      if (jsonSchema.minLength !== undefined) {
        stringSchema = stringSchema.min(jsonSchema.minLength);
      }
      if (jsonSchema.maxLength !== undefined) {
        stringSchema = stringSchema.max(jsonSchema.maxLength);
      }

      return stringSchema;

    case 'number':
      let numberSchema = z.number();
      
      if (jsonSchema.minimum !== undefined) {
        numberSchema = numberSchema.min(jsonSchema.minimum);
      }
      if (jsonSchema.maximum !== undefined) {
        numberSchema = numberSchema.max(jsonSchema.maximum);
      }
      if (jsonSchema.exclusiveMinimum !== undefined) {
        numberSchema = numberSchema.gt(jsonSchema.exclusiveMinimum);
      }
      if (jsonSchema.exclusiveMaximum !== undefined) {
        numberSchema = numberSchema.lt(jsonSchema.exclusiveMaximum);
      }
      
      return numberSchema;

    case 'integer':
      let intSchema = z.number().int();
      
      if (jsonSchema.minimum !== undefined) {
        intSchema = intSchema.min(jsonSchema.minimum);
      }
      if (jsonSchema.maximum !== undefined) {
        intSchema = intSchema.max(jsonSchema.maximum);
      }
      
      return intSchema;

    case 'boolean':
      return z.boolean();

    case 'array':
      let arraySchema = z.array(jsonSchema.items ? jsonSchemaToZod(jsonSchema.items) : z.any());
      
      if (jsonSchema.minItems !== undefined) {
        arraySchema = arraySchema.min(jsonSchema.minItems);
      }
      if (jsonSchema.maxItems !== undefined) {
        arraySchema = arraySchema.max(jsonSchema.maxItems);
      }
      
      return arraySchema;

    case 'object':
      const shape: Record<string, z.ZodSchema> = {};
      
      if (jsonSchema.properties && typeof jsonSchema.properties === 'object') {
        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          shape[key] = jsonSchemaToZod(propSchema);
        }
      }

      let objectSchema = z.object(shape);

      // Handle additionalProperties
      if (jsonSchema.additionalProperties === false) {
        objectSchema = objectSchema.strict();
      } else if (jsonSchema.additionalProperties === true) {
        objectSchema = objectSchema.catchall(z.any());
      } else if (typeof jsonSchema.additionalProperties === 'object') {
        objectSchema = objectSchema.catchall(jsonSchemaToZod(jsonSchema.additionalProperties));
      }

      return objectSchema;

    case 'null':
      return z.null();

    default:
      return z.any();
  }
}

/**
 * Valida un JSON Schema verificando que pueda ser convertido a Zod schema
 */
export function validateJsonSchema(jsonSchema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const zodSchema = jsonSchemaToZod(jsonSchema);
    
    // Test basic conversion
    if (!zodSchema) {
      errors.push('Failed to convert JSON Schema to Zod schema');
      return { valid: false, errors };
    }

    // Test with sample data if possible
    if (jsonSchema.type === 'object' && jsonSchema.properties && typeof jsonSchema.properties === 'object') {
      // Create sample data based on schema
      const sampleData: any = {};
      for (const [key, propSchema] of Object.entries(jsonSchema.properties as Record<string, any>)) {
        if (propSchema.type === 'string') {
          sampleData[key] = 'test';
        } else if (propSchema.type === 'number') {
          sampleData[key] = 1;
        } else if (propSchema.type === 'boolean') {
          sampleData[key] = true;
        } else {
          sampleData[key] = null;
        }
      }

      // Try to parse the sample data
      try {
        zodSchema.parse(sampleData);
      } catch (error) {
        errors.push(`Sample data validation failed: ${error}`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Conversion error: ${error}`);
    return { valid: false, errors };
  }
}