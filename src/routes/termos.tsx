import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Infradata" },
      {
        name: "description",
        content: "Condições de uso da plataforma Infradata de gestão financeira e de equipe.",
      },
      { property: "og:title", content: "Termos de uso — Infradata" },
      {
        property: "og:description",
        content: "Responsabilidades, limites de uso e regras de integração da plataforma.",
      },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    title: "1. Objeto",
    body: "A Infradata é uma plataforma de gestão empresarial que organiza informações financeiras, de equipe, metas e relatórios inseridas pela própria empresa usuária.",
  },
  {
    title: "2. Conta e responsabilidade",
    body: "Cada empresa é responsável pela veracidade dos dados cadastrados, pela gestão dos usuários que convida e pelas permissões que concede. Recomenda-se aplicar o princípio do menor privilégio.",
  },
  {
    title: "3. Cálculos e estimativas",
    body: "Os indicadores são calculados a partir dos lançamentos registrados pela empresa. Resultados apresentados como estimativa dependem integralmente da qualidade e completude desses lançamentos.",
  },
  {
    title: "4. Integrações financeiras",
    body: "A plataforma não acessa contas bancárias automaticamente. Qualquer integração futura ocorrerá apenas por APIs oficiais, com autorização explícita da empresa. O uso manual de receitas e despesas é plenamente suportado.",
  },
  {
    title: "5. Disponibilidade",
    body: "Buscamos alta disponibilidade e realizamos rotinas de backup, sem garantia de operação ininterrupta.",
  },
  {
    title: "6. Encerramento",
    body: "A empresa pode solicitar a exclusão da conta e dos seus dados a qualquer momento nas Configurações.",
  },
];

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-primary hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Condições para uso da plataforma.</p>
      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
