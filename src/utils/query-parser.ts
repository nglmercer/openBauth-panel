/**
 * PostgrestQueryParser - Parser para queries compatibles con Supabase PostgREST
 * 
 * Implementa el parsing de parámetros de query string en formato PostgREST:
 * - select: selección de columnas (select=id,name,email)
 * - where: filtros con operadores (id=eq.1, age=gte.18)
 * - order: ordenamiento (order=id.desc,order=name.asc)
 * - range: paginación (limit=10&offset=20)
 */
export class PostgrestQueryParser {
  private queryParams: URLSearchParams;

  constructor(queryString: string) {
    this.queryParams = new URLSearchParams(queryString);
  }

  /**
   * Parsea los filtros de la query string en formato PostgREST
   * Formatos soportados:
   * - campo=eq.valor (igual)
   * - campo=neq.valor (no igual)
   * - campo=gt.valor (mayor que)
   * - campo=gte.valor (mayor o igual que)
   * - campo=lt.valor (menor que)
   * - campo=lte.valor (menor o igual que)
   * - campo=like.valor (patrón LIKE)
   * - campo=ilike.valor (patrón ILIKE - case insensitive)
   * - campo=in.(val1,val2,val3) (en lista de valores)
   * - campo=is.null (es null)
   * - campo=is.not_null (no es null)
   */
  parseFilters(): Record<string, any> {
    const filters: Record<string, any> = {};

    for (const [key, value] of this.queryParams.entries()) {
      // Ignorar parámetros especiales de PostgREST
      if (this.isSpecialParam(key)) {
        continue;
      }

      // Parsear el valor del filtro
      const filter = this.parseFilterValue(value);
      filters[key] = filter;
    }

    return filters;
  }

  /**
   * Parsea un valor de filtro en formato PostgREST
   */
  private parseFilterValue(value: string): any {
    // Operadores simples
    if (value.startsWith('eq.')) {
      return this.parseValue(value.substring(3));
    }
    if (value.startsWith('neq.')) {
      return { '!=': this.parseValue(value.substring(4)) };
    }
    if (value.startsWith('gt.')) {
      return { '>': this.parseValue(value.substring(3)) };
    }
    if (value.startsWith('gte.')) {
      return { '>=': this.parseValue(value.substring(4)) };
    }
    if (value.startsWith('lt.')) {
      return { '<': this.parseValue(value.substring(3)) };
    }
    if (value.startsWith('lte.')) {
      return { '<=': this.parseValue(value.substring(4)) };
    }
    if (value.startsWith('like.')) {
      return { like: value.substring(5) };
    }
    if (value.startsWith('ilike.')) {
      return { ilike: value.substring(6) };
    }
    if (value.startsWith('in.(') && value.endsWith(')')) {
      const listStr = value.substring(4, value.length - 1);
      const values = listStr.split(',').map(v => this.parseValue(v.trim()));
      return { in: values };
    }
    if (value === 'is.null') {
      return null;
    }
    if (value === 'is.not_null') {
      return { '!=': null };
    }

    // Valor por defecto (eq)
    return this.parseValue(value);
  }

  /**
   * Parsea un valor string a su tipo correspondiente
   */
  private parseValue(value: string): any {
    // Manejar valores null
    if (value === 'null') {
      return null;
    }

    // Manejar números
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Manejar booleanos
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    // Manejar arrays JSON
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        return JSON.parse(value);
      } catch {
        // Si no es JSON válido, tratar como string
        return value;
      }
    }

    // Manejar objetos JSON
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch {
        // Si no es JSON válido, tratar como string
        return value;
      }
    }

    // Valor por defecto: string
    return value;
  }

  /**
   * Parsea el parámetro select para selección de columnas
   * Formato: select=id,name,email o select=*
   */
  parseSelect(): string[] | null {
    const selectParam = this.queryParams.get('select');
    
    if (!selectParam) {
      return null;
    }

    if (selectParam === '*') {
      return ['*'];
    }

    return selectParam.split(',').map(col => col.trim());
  }

  /**
   * Parsea el parámetro order para ordenamiento
   * Formatos soportados:
   * - order=campo.asc
   * - order=campo.desc
   * - order=campo (por defecto: asc)
   */
  parseOrder(): { orderBy: string; orderDirection?: 'ASC' | 'DESC' } | null {
    try {
      const orderParam = this.queryParams.get('order');
      
      if (!orderParam) {
        return null;
      }

      const parts = orderParam.split('.');
      const orderBy = parts[0];
      
      // Validar que orderBy no sea undefined o vacío
      if (!orderBy || orderBy.trim() === '') {
        throw new Error('Invalid order parameter: field name is required');
      }

      let orderDirection = parts[1] as 'ASC' | 'DESC' | undefined;

      // Convertir a mayúsculas y validar
      if (orderDirection) {
        orderDirection = orderDirection.toUpperCase() as 'ASC' | 'DESC';
        if (orderDirection !== 'ASC' && orderDirection !== 'DESC') {
          throw new Error(`Invalid order direction: ${orderDirection}`);
        }
      }

      return {
        orderBy: orderBy.trim(),
        orderDirection: orderDirection || 'ASC'
      };
    } catch (error) {
      // Re-throw the error instead of returning null to allow proper error handling
      throw error;
    }
  }

  /**
   * Parsea los parámetros limit y offset para paginación
   */
  parseRange(): { limit?: number; offset?: number } {
    const limitParam = this.queryParams.get('limit');
    const offsetParam = this.queryParams.get('offset');

    const result: { limit?: number; offset?: number } = {};

    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        result.limit = limit;
      }
    }

    if (offsetParam) {
      const offset = parseInt(offsetParam, 10);
      if (!isNaN(offset) && offset >= 0) {
        result.offset = offset;
      }
    }

    return result;
  }

  /**
   * Verifica si un parámetro es especial de PostgREST y debe ser ignorado en los filtros
   */
  private isSpecialParam(param: string): boolean {
    const specialParams = ['select', 'order', 'limit', 'offset'];
    return specialParams.includes(param);
  }

  /**
   * Parsea todos los parámetros y retorna un objeto completo de opciones de query
   */
  parseAll(): {
    filters: Record<string, any>;
    select: string[] | null;
    order: { orderBy: string; orderDirection?: 'ASC' | 'DESC' } | null;
    range: { limit?: number; offset?: number };
  } {
    return {
      filters: this.parseFilters(),
      select: this.parseSelect(),
      order: this.parseOrder(),
      range: this.parseRange()
    };
  }
}