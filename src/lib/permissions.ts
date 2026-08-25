export const PERMISSIONS = [
  { key: "finance.view", label: "Visualizar faturamento e financeiro" },
  { key: "revenues.edit", label: "Editar receitas" },
  { key: "expenses.edit", label: "Editar despesas" },
  { key: "employees.view", label: "Visualizar funcionários" },
  { key: "employees.edit", label: "Editar funcionários" },
  { key: "salaries.view", label: "Visualizar salários" },
  { key: "salaries.edit", label: "Editar salários" },
  { key: "goals.edit", label: "Gerenciar metas" },
  { key: "reports.export", label: "Exportar relatórios" },
  { key: "users.manage", label: "Gerenciar usuários e permissões" },
  { key: "org.manage", label: "Gerenciar dados da empresa" },
  { key: "audit.view", label: "Ver histórico de atividades" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Gestor financeiro",
  rh: "RH",
  colaborador: "Colaborador",
};

export const ROLE_DESCRIPTION: Record<string, string> = {
  admin: "Controle total da empresa, usuários e permissões.",
  financeiro: "Gerencia receitas, despesas, metas e relatórios financeiros.",
  rh: "Gerencia a equipe. Salários exigem permissão adicional.",
  colaborador: "Acesso limitado ao que for liberado explicitamente.",
};

export const BUSINESS_TYPES = [
  "Doceria",
  "Borracharia",
  "Papelaria",
  "Restaurante",
  "Loja",
  "Salão",
  "Barbearia",
  "Oficina",
  "Mercado",
  "Farmácia",
  "Outro",
];

export const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Salários",
  "Fornecedores",
  "Produtos",
  "Marketing",
  "Impostos",
  "Energia",
  "Água",
  "Internet",
  "Transporte",
  "Manutenção",
  "Outros",
];

export const REVENUE_CATEGORIES = [
  "Vendas",
  "Serviços",
  "Assinaturas",
  "Comissões",
  "Outras receitas",
];

export const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de débito",
  "Cartão de crédito",
  "Boleto",
  "Transferência",
];
