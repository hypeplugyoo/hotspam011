# Pulso Social — base segura para gestão de conteúdo

Aplicação Next.js em português, com PostgreSQL, Redis/BullMQ, worker separado, serviço privado de sessão e MinIO compatível com S3. Esta versão entrega autenticação do SaaS, isolamento básico por organização, cadastro de perfis sem credenciais do Instagram e upload privado de mídia. O dashboard e os resultados ainda incluem dados de demonstração. **Não é um serviço operacional de publicação ou coleta de métricas do Instagram.**

## Situação atual

- Cadastro e login do SaaS com senhas Argon2id, sessão opaca em cookie HttpOnly e token armazenado como hash.
- Criação de uma organização no cadastro. Consultas e operações de perfis, grupos e mídias são escopadas pela organização da sessão.
- Limite de 500 perfis aplicado no servidor com bloqueio transacional por organização.
- Cadastro de nome de usuário apenas. Nenhuma senha ou cookie do Instagram é solicitado ou armazenado; contas ficam desconectadas.
- Upload autenticado para armazenamento S3 com URLs pré-assinadas de curta duração; conclusão valida tamanho e assinatura real do tipo de arquivo.
- Auditoria para cadastro de perfil, grupo e mídia; endpoints iniciais para contas e grupos.
- Filas de publicação e métricas, lease Redis por conta, adaptador Instagram desativado, schema de lotes, tentativas, métricas e intervenções.
- Dashboard claramente marcado como demonstração. Os valores exibidos não vêm de contas reais.

### O que está desligado

Não existe fluxo de autenticação do Instagram, persistência de sessões do Instagram, navegação Playwright no site, publicação, reconciliação de resultados, intervenção em verificações nem leitura de métricas reais. A ação “Nova publicação”, filas e worker não enviam posts. A central de verificações e agendamentos não é operacional. A simulação de 500 tarefas não é teste de capacidade de navegador.

O projeto não usa a API da Meta. A automação de acesso à interface do Instagram não foi habilitada: os Termos oficiais vedam acesso ou coleta automatizada sem permissão expressa. Só avance para um adaptador real após obter e documentar essa autorização; preserve a intervenção humana e não implemente bypass de CAPTCHA, controles de acesso ou restrições.

## Requisitos e início local

Requer Node.js 22+ e Docker Compose. Configure os segredos locais antes de iniciar:

```bash
cp .env.example .env
```

Edite `.env` com valores locais exclusivos para `POSTGRES_PASSWORD`, `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD`. Gere também chaves distintas para `APP_ENCRYPTION_KEY` e `SESSION_ENCRYPTION_KEY` com `openssl rand -base64 32`. O `.env` contém segredos e não deve ser commitado.

```bash
docker compose up --build
```

Abra `http://localhost:3000/register` para criar a primeira organização. Testes e verificações:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run simulate:500
```

O Compose cria Postgres, Redis e MinIO, configura CORS de desenvolvimento e carrega `db/init.sql` na primeira inicialização do volume. Para uma instalação local descartável, `docker compose down -v` remove os volumes e **apaga os dados**.

## Serviços

| Serviço | Função | Estado |
| --- | --- | --- |
| `web` | Next.js, telas e endpoints HTTP | Login, cadastro SaaS, contas, grupos e mídias iniciais; dashboard com demonstração |
| `worker` | Consumidor BullMQ isolado | Adaptador externo desligado; não publica |
| `session` | Canal privado de sessão/intervenção | Esqueleto de saúde; não abre navegador; porta mapeada apenas em `127.0.0.1` |
| `postgres` | Persistência | Schema inicial e migração de sessão/mídia |
| `redis` | Filas e leases | Configurado para filas e bloqueios |
| `minio` | Armazenamento local compatível com S3 | Upload e download privado via URL temporária |

As migrations estão em `db/migrations`. `db/init.sql` é o schema consolidado usado pelo Compose em banco novo; migrações incrementais para instalações existentes precisam ser aplicadas em ordem.

## Segurança e limites conhecidos

- Autenticação por e-mail e senha do SaaS; cookie `HttpOnly`, `SameSite=Strict`, sessão expira em 14 dias e pode ser revogada no logout.
- Todas as operações de contas, grupos e mídias obtêm a organização da sessão no servidor; IDs de outras organizações não dão acesso aos objetos.
- O proxy Next.js usa o cookie para encaminhar visitantes ao login, mas autorização efetiva fica nos endpoints.
- URLs assinadas de upload expiram em 5 minutos; links de download expiram em 10 minutos. Tipos permitidos: JPEG, PNG, WebP e MP4. Imagens: até 20 MB; MP4: até 100 MB.
- O limite de mídia e formatos ainda não valida dimensão, proporção ou duração dos vídeos.
- Registro público não tem confirmação de e-mail, MFA ou limitação de tentativas/rate limit. Configure proteção de rede e identidade adicional antes de expor o serviço à internet.
- CORS do MinIO aponta para `localhost:3000`; configure origens e armazenamento apropriados antes de um ambiente remoto.
- Chaves de criptografia são placeholders no `.env.example`; não há credenciais ou sessões do Instagram armazenadas.
- Idempotência interna evita tarefas duplicadas na aplicação quando o fluxo for conectado, mas não garante execução única na plataforma.
- Métricas demo não são leituras observadas. Não há coleta periódica e números indisponíveis nunca devem ser apresentados como zero real.

## Próximos passos para completar o produto

1. Adicionar convites e gestão de usuários por organização, controles de acesso por papel, rate limiting e recuperação segura de conta.
2. Completar CRUD de grupos, remoção/reconexão de perfis e gestão da biblioteca.
3. Integrar formulários de criação a tarefas persistentes, idempotência, cancelamento, pausa e limites de concorrência; manter publicação desligada até a autorização expressa.
4. Após autorização, implementar o adaptador isolado com sessão separada por perfil, intervenção humana privada, confirmação observável e estado incerto sem reenvio cego.
5. Validar na interface autorizada quais formatos e métricas estão disponíveis. Coletar snapshots com definição, origem, cobertura e horário; preservar correções negativas.
6. Executar fluxo de ponta a ponta com poucas contas autorizadas e depois medir CPU, memória e duração antes de qualquer teste de expansão.

Stories não fazem parte do escopo inicial. Não declare o sistema operacional para publicar até que o fluxo real tenha passado pelos testes com poucas contas autorizadas.
