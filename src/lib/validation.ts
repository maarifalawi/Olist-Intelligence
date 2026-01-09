import { REQUIRED_FILES, FileKey } from './constants';

export interface ValidationError {
  file: string;
  column: string;
  error_type: 'missing_column' | 'invalid_type' | 'parse_error';
  message: string;
  sample_value?: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  rowCount: number;
  columnCount: number;
  columns: string[];
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV<T>(csvText: string): { data: T[]; headers: string[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return { data: [], headers: [] };
  }

  // Parse header - handle BOM and quotes
  let headerLine = lines[0].replace(/^\uFEFF/, ''); // Remove BOM if present
  const headers = parseCSVLine(headerLine);

  const data: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, unknown> = {};
    
    headers.forEach((header, index) => {
      let value: unknown = values[index] ?? '';
      
      // Clean up string values
      if (typeof value === 'string') {
        value = value.trim();
        // Convert empty strings to null for certain fields
        if (value === '' || value === 'null' || value === 'NULL') {
          value = null;
        }
      }
      
      row[header] = value;
    });
    
    data.push(row as T);
  }

  return { data, headers };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(v => v.replace(/^"|"$/g, '')); // Remove surrounding quotes
}

/**
 * Validate a file against its required schema
 */
export function validateFile(
  fileKey: FileKey,
  csvText: string
): ValidationResult {
  const fileConfig = REQUIRED_FILES.find(f => f.key === fileKey);
  if (!fileConfig) {
    return {
      isValid: false,
      errors: [{ file: fileKey, column: '', error_type: 'parse_error', message: 'Konfigurasi file tidak ditemukan' }],
      warnings: [],
      rowCount: 0,
      columnCount: 0,
      columns: [],
    };
  }

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    const { data, headers } = parseCSV(csvText);
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    // Check required columns
    for (const required of fileConfig.required_columns) {
      const normalizedRequired = required.toLowerCase();
      if (!normalizedHeaders.includes(normalizedRequired)) {
        errors.push({
          file: fileConfig.display,
          column: required,
          error_type: 'missing_column',
          message: `Kolom wajib "${required}" tidak ditemukan`,
          suggestion: `Pastikan file memiliki kolom "${required}"`,
        });
      }
    }

    // Check for empty data
    if (data.length === 0) {
      warnings.push('File tidak memiliki data (hanya header)');
    }

    // Sample data validation for specific types
    if (data.length > 0 && errors.length === 0) {
      const sample = data[0] as Record<string, unknown>;
      
      // Validate numeric fields
      const numericFields = ['price', 'freight_value', 'payment_value', 'review_score', 'payment_installments'];
      for (const field of numericFields) {
        if (field in sample && sample[field] !== null) {
          const value = sample[field];
          if (typeof value === 'string' && isNaN(parseFloat(value))) {
            warnings.push(`Kolom "${field}" mungkin memiliki nilai non-numerik`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      rowCount: data.length,
      columnCount: headers.length,
      columns: headers,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        file: fileConfig.display,
        column: '',
        error_type: 'parse_error',
        message: `Gagal memparse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      warnings: [],
      rowCount: 0,
      columnCount: 0,
      columns: [],
    };
  }
}

/**
 * Identify file type from filename
 */
export function identifyFileType(filename: string): FileKey | null {
  const normalized = filename.toLowerCase().trim();
  
  for (const config of REQUIRED_FILES) {
    if (normalized.includes(config.key) || normalized === config.filename.toLowerCase()) {
      return config.key as FileKey;
    }
  }
  
  // Fallback: try to match by partial name
  if (normalized.includes('customer')) return 'customers';
  if (normalized.includes('order_item') || normalized.includes('items')) return 'order_items';
  if (normalized.includes('order') && !normalized.includes('item') && !normalized.includes('review') && !normalized.includes('payment')) return 'orders';
  if (normalized.includes('payment')) return 'payments';
  if (normalized.includes('review')) return 'reviews';
  if (normalized.includes('product') && !normalized.includes('translation')) return 'products';
  if (normalized.includes('seller')) return 'sellers';
  if (normalized.includes('geo')) return 'geolocation';
  if (normalized.includes('translation') || normalized.includes('category')) return 'translations';
  
  return null;
}
