// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// JSON Schema → Zod converter (for MCP SDK)
//
// 為什麼獨立成 module：
//   mcp-server.js 以前內嵌一個 jsonSchemaToZod，只認 number/boolean/array/string，
//   任何 type:"object" / "integer" / nested enum 都會掉到 default → z.string()。
//   2026-05-18 修：抽出來重寫，遞迴支援 object / array(items) / enum / nullable / integer，
//   tests/mcp-schema-conversion.test.js 跟 mcp-server.js 共用同一份實作。
//
// 用法：
//   const { buildObjectSchema } = require('./lib/mcp-schema');
//   const zodSchema = buildObjectSchema(jsonSchemaWithProperties);
// ============================================
'use strict';

const { z } = require('zod');

function convertField(def) {
  if (!def || typeof def !== 'object') return z.unknown();

  // enum 不管 type，最強限制優先
  if (Array.isArray(def.enum) && def.enum.length > 0) {
    const allStrings = def.enum.every(v => typeof v === 'string');
    if (allStrings) return z.enum(def.enum);
    return z.union(def.enum.map(v => z.literal(v)));
  }

  let field;
  switch (def.type) {
    case 'string':
      field = z.string();
      break;
    case 'number':
      field = z.number();
      break;
    case 'integer':
      field = z.number().int();
      break;
    case 'boolean':
      field = z.boolean();
      break;
    case 'array':
      field = def.items ? z.array(convertField(def.items)) : z.array(z.unknown());
      break;
    case 'object':
      if (def.properties) {
        field = buildObjectSchema(def);
      } else {
        // 自由格式 dict（paramGrid / key_levels 之類）
        // Zod 4 簽名：z.record(keyType, valueType)
        field = z.record(z.string(), z.unknown());
      }
      break;
    case 'null':
      field = z.null();
      break;
    default:
      field = z.unknown();
  }

  if (def.nullable === true) field = field.nullable();
  return field;
}

function buildObjectSchema(schema) {
  if (!schema || !schema.properties) return z.object({});
  const shape = {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const [key, def] of Object.entries(schema.properties)) {
    let field = convertField(def);
    if (def && def.description) field = field.describe(def.description);
    shape[key] = required.includes(key) ? field : field.optional();
  }
  return z.object(shape);
}

module.exports = { convertField, buildObjectSchema };
