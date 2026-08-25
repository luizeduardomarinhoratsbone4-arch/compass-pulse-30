import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Infradata" },
      {
        name: "description",
        content:
          "Como a Infradata coleta, usa, protege e retém os dados das empresas e das pessoas usuárias.",
      },
      { property: "og:title", content: "Política de privacidade — Infradata" },
      {
        property: "og:description",
        content: "Coleta mínima, finalidade clara, controle de acesso e direitos do titular.",
      },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  {
    title: "1. Dados que coletamos",
    body: "Coletamos apenas o necessário para operar a plataforma: dados de conta (nome, e-mail), dados cadastrais da empresa (razão social, nome fantasia, identificador empresarial, contato e localidade) e os registros financeiros e de equipe que a própria empresa insere.",
  },
  {
    title: "2. Finalidade",
    body: "Os dados são usados exclusivamente para autenticar o acesso, apresentar indicadores financeiros e de equipe à própria empresa, registrar auditoria de ações relevantes e manter a segurança do serviço.",
  },
  {
    title: "3. Isolamento entre empresas",
    body: "Cada empresa possui uma conta independente. Os registros são vinculados à organização e as regras de acesso são aplicadas no servidor. Nenhuma empresa acessa dados de outra.",
  },
  {
    title: "4. Dados sensíveis",
    body: "Informações de remuneração ficam em armazenamento separado e só são exibidas a pessoas com a permissão específica de visualizar salários.",
  },
  {
    title: "5. Retenção e exclusão",
    body: "Os dados permanecem enquanto a conta estiver ativa. A empresa pode solicitar exportação ou exclusão dos seus dados a qualquer momento nas Configurações.",
  },
  {
    title: "6. Segurança",
    body: "Utilizamos transporte criptografado (HTTPS/TLS), senhas armazenadas apenas como hash com salt, controle de sessão, expiração de token, autorização validada no servidor e registro de auditoria.",
  },
  {
    title: "7. Observação legal",
    body: "Esta política descreve práticas alinhadas aos princípios da LGPD. Ela não constitui, por si só, declaração de conformidade jurídica ou certificação.",
  },
];

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-primary hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
        Política de privacidade
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Como tratamos os dados na plataforma Infradata.
      </p>
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
