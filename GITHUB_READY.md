# GitHub ready

Projeto preparado pelo Agent Nexus para subir ao GitHub.

## Projeto

- Nome: Almoxarifado Master Cargas
- ID: proj_almoxarifado-master-cargas-main_active
- Visibilidade sugerida: public

## Segurança

- `.env`, `.env.*`, `node_modules`, builds e logs estao ignorados no Git.
- Use `.env.example` como referencia.
- Nao suba chaves reais em commits.

## Comandos manuais

```bash
git init
git add .
git commit -m "Initial Agent Nexus project"
gh repo create almoxarifado-master-cargas --public --source . --remote origin --push
```
