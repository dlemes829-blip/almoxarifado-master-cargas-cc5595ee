import { users, products, movements, history, responsaveis } from "@shared/schema";
import type { InsertUser, InsertProduct, InsertMovement, InsertHistory, InsertResponsavel, User, Product, Movement, History, Responsavel, UpdateUserRequest, UpdateProductRequest, UpdateResponsavelRequest } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UpdateUserRequest): Promise<User>;
  updateAvatar(userId: number, avatarUrl: string | null): Promise<void>;
  deleteUser(id: number): Promise<void>;
  getUsers(): Promise<User[]>;

  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getProducts(): Promise<Product[]>;

  createMovement(movement: InsertMovement): Promise<Movement>;
  getMovements(): Promise<Movement[]>;

  createHistory(log: InsertHistory): Promise<History>;
  getHistory(): Promise<History[]>;

  getResponsaveis(): Promise<Responsavel[]>;
  getResponsavel(id: number): Promise<Responsavel | undefined>;
  createResponsavel(responsavel: InsertResponsavel): Promise<Responsavel>;
  updateResponsavel(id: number, responsavel: UpdateResponsavelRequest): Promise<Responsavel>;
  deleteResponsavel(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, update: UpdateUserRequest): Promise<User> {
    const [user] = await db.update(users).set(update).where(eq(users.id, id)).returning();
    return user;
  }

  // ✅ Método dedicado para avatar — usa SQL direto para evitar erro de tipo no Drizzle
  async updateAvatar(userId: number, avatarUrl: string | null): Promise<void> {
    const client = (db as any).session?.client || (db as any).$client;
    if (client && typeof client.query === "function") {
      // Driver pg direto
      await client.query(
        "UPDATE users SET avatar_url = $1 WHERE id = $2",
        [avatarUrl, userId]
      );
    } else {
      // Fallback: Drizzle ORM com campo correto
      await db.update(users)
        .set({ avatar_url: avatarUrl } as any)
        .where(eq(users.id, userId));
    }
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, update: UpdateProductRequest): Promise<Product> {
    const [product] = await db.update(products).set(update).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async createMovement(insertMovement: InsertMovement): Promise<Movement> {
    const [movement] = await db.insert(movements).values(insertMovement as any).returning();
    return movement;
  }

  async getMovements(): Promise<Movement[]> {
    return await db.select().from(movements).orderBy(desc(movements.data_hora));
  }

  async createHistory(insertHistory: InsertHistory): Promise<History> {
    const [log] = await db.insert(history).values(insertHistory).returning();
    return log;
  }

  async getHistory(): Promise<History[]> {
    return await db.select().from(history).orderBy(desc(history.data_hora));
  }

  async getResponsaveis(): Promise<Responsavel[]> {
    return await db.select().from(responsaveis);
  }

  async getResponsavel(id: number): Promise<Responsavel | undefined> {
    const [r] = await db.select().from(responsaveis).where(eq(responsaveis.id, id));
    return r;
  }

  async createResponsavel(insertR: InsertResponsavel): Promise<Responsavel> {
    const [r] = await db.insert(responsaveis).values(insertR).returning();
    return r;
  }

  async updateResponsavel(id: number, update: UpdateResponsavelRequest): Promise<Responsavel> {
    const [r] = await db.update(responsaveis).set(update).where(eq(responsaveis.id, id)).returning();
    return r;
  }

  async deleteResponsavel(id: number): Promise<void> {
    await db.delete(responsaveis).where(eq(responsaveis.id, id));
  }
}

class MemoryStorage implements IStorage {
  private users: User[] = [];
  private products: Product[] = [];
  private movements: Movement[] = [];
  private history: History[] = [];
  private responsaveis: Responsavel[] = [];
  private userSeq = 1;
  private productSeq = 1;
  private movementSeq = 1;
  private historySeq = 1;
  private responsavelSeq = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username.toLowerCase() === username.toLowerCase());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = {
      cargo: "Usuario Comum",
      active: true,
      pode_ver_dashboard: false,
      pode_ver_produtos: false,
      pode_registrar_entrada: false,
      pode_registrar_saida: false,
      pode_ver_historico: false,
      pode_ver_chat: false,
      pode_exportar_relatorio: false,
      pode_gerenciar_usuarios: false,
      must_change_password: false,
      theme_preference: "dark",
      avatar_url: null,
      created_at: new Date(),
      ...insertUser,
      id: this.userSeq++,
    } as User;
    this.users.push(user);
    return user;
  }

  async updateUser(id: number, update: UpdateUserRequest): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    Object.assign(user, update);
    return user;
  }

  async updateAvatar(userId: number, avatarUrl: string | null): Promise<void> {
    const user = await this.getUser(userId);
    if (user) user.avatar_url = avatarUrl;
  }

  async deleteUser(id: number): Promise<void> {
    this.users = this.users.filter((user) => user.id !== id);
  }

  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.find((product) => product.id === id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product = {
      codigo_barras: null,
      localizacao: null,
      estoque_minimo: 0,
      ativo: true,
      data_cadastro: new Date(),
      criado_por: null,
      ...insertProduct,
      id: this.productSeq++,
    } as Product;
    this.products.push(product);
    return product;
  }

  async updateProduct(id: number, update: UpdateProductRequest): Promise<Product> {
    const product = await this.getProduct(id);
    if (!product) throw new Error("Product not found");
    Object.assign(product, update);
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    this.products = this.products.filter((product) => product.id !== id);
  }

  async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async createMovement(insertMovement: InsertMovement): Promise<Movement> {
    const movement = {
      responsavel_id: null,
      data_hora: new Date(),
      observacao: null,
      ...insertMovement,
      id: this.movementSeq++,
    } as Movement;
    this.movements.push(movement);
    return movement;
  }

  async getMovements(): Promise<Movement[]> {
    return [...this.movements].sort((a, b) => new Date(b.data_hora || 0).getTime() - new Date(a.data_hora || 0).getTime());
  }

  async createHistory(insertHistory: InsertHistory): Promise<History> {
    const log = {
      ip: null,
      data_hora: new Date(),
      ...insertHistory,
      id: this.historySeq++,
    } as History;
    this.history.push(log);
    return log;
  }

  async getHistory(): Promise<History[]> {
    return [...this.history].sort((a, b) => new Date(b.data_hora || 0).getTime() - new Date(a.data_hora || 0).getTime());
  }

  async getResponsaveis(): Promise<Responsavel[]> {
    return [...this.responsaveis];
  }

  async getResponsavel(id: number): Promise<Responsavel | undefined> {
    return this.responsaveis.find((responsavel) => responsavel.id === id);
  }

  async createResponsavel(insertR: InsertResponsavel): Promise<Responsavel> {
    const responsavel = {
      ativo: true,
      created_at: new Date(),
      ...insertR,
      id: this.responsavelSeq++,
    } as Responsavel;
    this.responsaveis.push(responsavel);
    return responsavel;
  }

  async updateResponsavel(id: number, update: UpdateResponsavelRequest): Promise<Responsavel> {
    const responsavel = await this.getResponsavel(id);
    if (!responsavel) throw new Error("Responsavel not found");
    Object.assign(responsavel, update);
    return responsavel;
  }

  async deleteResponsavel(id: number): Promise<void> {
    this.responsaveis = this.responsaveis.filter((responsavel) => responsavel.id !== id);
  }
}

const useDatabaseStorage = Boolean(process.env.DATABASE_URL) && process.env.NEXUS_FORCE_MEMORY_DB !== "1";

export const storage: IStorage = useDatabaseStorage ? new DatabaseStorage() : new MemoryStorage();
