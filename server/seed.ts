import { storage } from "./storage";
import { log } from "./index";
import bcrypt from "bcryptjs";
import { categorizeProduct } from "./categorize";

const EXTERNAL_API = "https://site-multilingue.replit.app/api/products";

export async function seedDatabase() {
  try {
    const existingUsers = await storage.getUsers();
    if (existingUsers.length === 0) {
      log("No users found, creating default DEV user...", "seed");
      const hashedPassword = await bcrypt.hash("120605", 10);
      await storage.createUser({
        username: "DEV",
        password: hashedPassword,
        cargo: "Desenvolvedor",
        active: true,
        pode_ver_dashboard: true,
        pode_ver_produtos: true,
        pode_registrar_entrada: true,
        pode_registrar_saida: true,
        pode_ver_historico: true,
        pode_ver_chat: true,
        pode_exportar_relatorio: true,
        pode_gerenciar_usuarios: true,
        must_change_password: false,
        theme_preference: "dark",
      });
      log("Default DEV user created", "seed");
    }

    const existingProducts = await storage.getProducts();
    
    if (existingProducts.length === 0) {
      log("Database is empty, importing products from external API...", "seed");

      const response = await fetch(EXTERNAL_API);
      if (!response.ok) {
        log(`Failed to fetch products from external API: ${response.status}`, "seed");
        return;
      }

      const externalProducts = await response.json();
      if (!Array.isArray(externalProducts) || externalProducts.length === 0) {
        log("No products found in external API", "seed");
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (const item of externalProducts) {
        const nome = item.nome || item.name || "SEM NOME";
        const { categoria, estoque_minimo } = categorizeProduct(nome);
        const apiCategoria = item.categoria || item.category || "OUTROS";
        const finalCategoria = apiCategoria !== "OUTROS" ? apiCategoria : categoria;
        
        try {
          await storage.createProduct({
            nome,
            codigo_barras: item.codigo_barras || item.barcode || null,
            categoria: finalCategoria,
            quantidade_atual: item.quantidade ?? item.quantity ?? 0,
            unidade: item.unidade || item.unit || "UN",
            localizacao: item.localizacao || item.location || null,
            estoque_minimo: item.estoque_minimo ?? item.min_stock ?? item.minStock ?? estoque_minimo,
            ativo: item.ativo ?? item.active ?? true,
            criado_por: 1,
          });
          imported++;
        } catch (e) {
          skipped++;
        }
      }

      log(`Seed complete: ${imported} products imported, ${skipped} skipped`, "seed");

      await storage.createHistory({
        usuario: "SISTEMA",
        acao: "Seed Automático",
        modulo: "Produtos",
        descricao: `Importou ${imported} produtos automaticamente (banco vazio)`,
        ip: "localhost"
      });
    } else {
      log(`Database already has ${existingProducts.length} products`, "seed");
      await recategorizeProducts(existingProducts);
    }
  } catch (err) {
    log(`Seed error: ${err}`, "seed");
  }
}

export async function recategorizeProducts(products?: any[]) {
  try {
    const allProducts = products || await storage.getProducts();
    const outrosCount = allProducts.filter(p => p.categoria === "OUTROS").length;
    const outrosRatio = allProducts.length > 0 ? outrosCount / allProducts.length : 0;

    if (outrosRatio < 0.5 && !products) {
      log(`Only ${outrosCount}/${allProducts.length} products are OUTROS (${(outrosRatio*100).toFixed(0)}%), skipping recategorization`, "seed");
      return { updated: 0, total: allProducts.length };
    }

    log(`Recategorizing ${allProducts.length} products (${outrosCount} currently OUTROS)...`, "seed");
    let updated = 0;

    for (const p of allProducts) {
      const { categoria, estoque_minimo } = categorizeProduct(p.nome);
      const needsCatUpdate = p.categoria === "OUTROS" && categoria !== "OUTROS";
      const needsMinUpdate = p.estoque_minimo === 2 && estoque_minimo !== 2;
      
      if (needsCatUpdate || needsMinUpdate) {
        const updateData: any = {};
        if (needsCatUpdate) updateData.categoria = categoria;
        if (needsMinUpdate) updateData.estoque_minimo = estoque_minimo;
        
        await storage.updateProduct(p.id, updateData);
        updated++;
      }
    }

    log(`Recategorization complete: ${updated} products updated`, "seed");
    
    if (updated > 0) {
      await storage.createHistory({
        usuario: "SISTEMA",
        acao: "Recategorização Automática",
        modulo: "Produtos",
        descricao: `Recategorizou ${updated} produtos automaticamente`,
        ip: "localhost"
      });
    }

    return { updated, total: allProducts.length };
  } catch (err) {
    log(`Recategorization error: ${err}`, "seed");
    return { updated: 0, total: 0 };
  }
}
