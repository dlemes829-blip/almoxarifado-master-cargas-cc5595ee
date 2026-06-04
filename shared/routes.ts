import { z } from 'zod';
import { insertUserSchema, insertProductSchema, insertMovementSchema, insertResponsavelSchema, users, products, movements, history, responsaveis, loginRequestSchema, changePasswordSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: loginRequestSchema,
      responses: {
        200: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>(), mustChangePassword: z.boolean().optional() }),
        401: errorSchemas.unauthorized,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    changePassword: {
      method: 'POST' as const,
      path: '/api/auth/change-password' as const,
      input: changePasswordSchema,
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/users' as const,
      input: insertUserSchema,
      responses: { 201: z.custom<typeof users.$inferSelect>() }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id' as const,
      input: insertUserSchema.partial(),
      responses: { 200: z.custom<typeof users.$inferSelect>(), 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound }
    }
  },
  responsaveis: {
    list: {
      method: 'GET' as const,
      path: '/api/responsaveis' as const,
      responses: { 200: z.array(z.custom<typeof responsaveis.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/responsaveis' as const,
      input: insertResponsavelSchema,
      responses: { 201: z.custom<typeof responsaveis.$inferSelect>() }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/responsaveis/:id' as const,
      input: insertResponsavelSchema.partial(),
      responses: { 200: z.custom<typeof responsaveis.$inferSelect>(), 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/responsaveis/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound }
    }
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      responses: { 200: z.array(z.custom<typeof products.$inferSelect>()) }
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id' as const,
      responses: { 200: z.custom<typeof products.$inferSelect>(), 404: errorSchemas.notFound }
    },
    create: {
      method: 'POST' as const,
      path: '/api/products' as const,
      input: insertProductSchema,
      responses: { 201: z.custom<typeof products.$inferSelect>() }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id' as const,
      input: insertProductSchema.partial(),
      responses: { 200: z.custom<typeof products.$inferSelect>(), 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound }
    }
  },
  movements: {
    list: {
      method: 'GET' as const,
      path: '/api/movements' as const,
      responses: { 200: z.array(z.custom<typeof movements.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/movements' as const,
      input: insertMovementSchema,
      responses: { 201: z.custom<typeof movements.$inferSelect>(), 400: errorSchemas.validation }
    },
    bulkExit: {
      method: 'POST' as const,
      path: '/api/movements/bulk-exit' as const,
      input: z.object({
        items: z.array(z.object({
          produto_id: z.number(),
          quantidade: z.number().min(1),
        })),
        observacao: z.string().optional(),
      }),
      responses: {
        201: z.object({ processed: z.number(), skipped: z.number() }),
        400: errorSchemas.validation,
      }
    }
  },
  history: {
    list: {
      method: 'GET' as const,
      path: '/api/history' as const,
      responses: { 200: z.array(z.custom<typeof history.$inferSelect>()) }
    }
  },
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard' as const,
      responses: {
        200: z.object({
          totalProducts: z.number(),
          totalStock: z.number(),
          lowStock: z.number(),
          entriesToday: z.number(),
          exitsToday: z.number(),
          entriesItemsToday: z.number(),
          exitsItemsToday: z.number(),
          activeUsers: z.number(),
          totalEntries: z.number(),
          totalExits: z.number(),
          totalEntriesItems: z.number(),
          totalExitsItems: z.number(),
          recentMovements: z.array(z.object({
            id: z.number(),
            productName: z.string(),
            tipo: z.string(),
            quantidade: z.number(),
            usuario: z.string(),
            data_hora: z.string().nullable(),
          })),
          todayActivity: z.array(z.object({
            id: z.number(),
            usuario: z.string(),
            acao: z.string(),
            modulo: z.string(),
            descricao: z.string(),
            data_hora: z.string().nullable(),
          })).optional(),
          categoryBreakdown: z.record(z.string(), z.object({ count: z.number(), stock: z.number() })).optional(),
          lowStockList: z.array(z.any()).optional(),
          rankingList: z.array(z.object({
            username: z.string(),
            entries: z.number(),
            exits: z.number(),
            totalItems: z.number(),
          })).optional(),
        })
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
