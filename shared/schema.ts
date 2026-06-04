import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  cargo: text("cargo").default("Usuário Comum"),
  active: boolean("active").default(true),
  pode_ver_dashboard: boolean("pode_ver_dashboard").default(false),
  pode_ver_produtos: boolean("pode_ver_produtos").default(false),
  pode_registrar_entrada: boolean("pode_registrar_entrada").default(false),
  pode_registrar_saida: boolean("pode_registrar_saida").default(false),
  pode_ver_historico: boolean("pode_ver_historico").default(false),
  pode_ver_chat: boolean("pode_ver_chat").default(false),
  pode_exportar_relatorio: boolean("pode_exportar_relatorio").default(false),
  pode_gerenciar_usuarios: boolean("pode_gerenciar_usuarios").default(false),
  must_change_password: boolean("must_change_password").default(false),
  theme_preference: text("theme_preference").default("dark"),
  avatar_url: text("avatar_url"),
  created_at: timestamp("created_at").defaultNow(),
});

export const responsaveis = pgTable("responsaveis", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  setor: text("setor").notNull(),
  ativo: boolean("ativo").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  codigo_barras: text("codigo_barras"),
  nome: text("nome").notNull(),
  categoria: text("categoria").notNull(),
  quantidade_atual: integer("quantidade_atual").notNull().default(0),
  unidade: text("unidade").notNull(),
  localizacao: text("localizacao"),
  estoque_minimo: integer("estoque_minimo").notNull().default(0),
  ativo: boolean("ativo").default(true),
  data_cadastro: timestamp("data_cadastro").defaultNow(),
  criado_por: integer("criado_por").references(() => users.id),
});

export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  produto_id: integer("produto_id").references(() => products.id).notNull(),
  tipo: text("tipo").notNull(),
  quantidade: integer("quantidade").notNull(),
  usuario_id: integer("usuario_id").references(() => users.id).notNull(),
  responsavel_id: integer("responsavel_id").references(() => responsaveis.id),
  data_hora: timestamp("data_hora").defaultNow(),
  observacao: text("observacao"),
});

export const history = pgTable("history", {
  id: serial("id").primaryKey(),
  usuario: text("usuario").notNull(),
  acao: text("acao").notNull(),
  modulo: text("modulo").notNull(),
  descricao: text("descricao").notNull(),
  data_hora: timestamp("data_hora").defaultNow(),
  ip: text("ip"),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  creator: one(users, {
    fields: [products.criado_por],
    references: [users.id],
  }),
  movements: many(movements),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  product: one(products, {
    fields: [movements.produto_id],
    references: [products.id],
  }),
  user: one(users, {
    fields: [movements.usuario_id],
    references: [users.id],
  }),
  responsavel: one(responsaveis, {
    fields: [movements.responsavel_id],
    references: [responsaveis.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  created_at: true 
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true, data_cadastro: true });
export const insertMovementSchema = createInsertSchema(movements).omit({ id: true, data_hora: true }).extend({
  usuario_id: z.number().optional(),
  responsavel_id: z.number().nullable().optional(),
  observacao: z.string().nullable().optional(),
});
export const insertHistorySchema = createInsertSchema(history).omit({ id: true, data_hora: true });
export const insertResponsavelSchema = createInsertSchema(responsaveis).omit({ id: true, created_at: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Movement = typeof movements.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type History = typeof history.$inferSelect;
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type Responsavel = typeof responsaveis.$inferSelect;
export type InsertResponsavel = z.infer<typeof insertResponsavelSchema>;

export const loginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(4),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export type UpdateUserRequest = Partial<InsertUser>;
export type UpdateProductRequest = Partial<InsertProduct>;
export type UpdateResponsavelRequest = Partial<InsertResponsavel>;
