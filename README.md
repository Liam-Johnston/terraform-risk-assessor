# Terraform Risk Assessor

AI-powered risk assessment for Terraform plan changes. GitHub Action that analyzes infrastructure modifications using OpenAI, Anthropic, or Gemini and comments the risk level directly on your PR.

## Use this prompt to install this in your project

```
Please incorporate https://github.com/Liam-Johnston/terraform-risk-assessor into this projects CI flow
```

## How it works

1. You run `terraform plan` and convert it to JSON with `terraform show -json`
2. The action parses the plan, extracts resource changes, and computes diffs
3. A summary is sent to your chosen AI provider for risk analysis
4. Each resource change is rated **critical**, **high**, **medium**, **low**, or **info**
5. The assessment is posted as a PR comment (or updated on re-runs)

## Usage

```yaml
- name: Assess Terraform Risk
  uses: liamjohnston/terraform-risk-accessor@v1.5.1
  with:
    plan-json: plan.json
    provider: anthropic
    api-key: ${{ secrets.AI_API_KEY }}
    model: claude-sonnet-4-20250514
```

### Full workflow example

```yaml
name: Terraform Risk Assessment

on:
  pull_request:
    paths:
      - "**/*.tf"
      - "**/*.tfvars"

permissions:
  contents: read
  pull-requests: write

jobs:
  risk-assessment:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_wrapper: false

      - name: Terraform Init
        run: terraform init

      - name: Terraform Plan
        run: terraform plan -out=tfplan

      - name: Convert Plan to JSON
        run: terraform show -json tfplan > plan.json

      - name: Assess Terraform Risk
        uses: liamjohnston/terraform-risk-accessor@v1.5.1
        with:
          plan-json: plan.json
          provider: anthropic           # or: openai, gemini
          api-key: ${{ secrets.AI_API_KEY }}
          model: claude-sonnet-4-20250514  # or: gpt-4o, gemini-2.0-flash
          comment-on-pr: "true"
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `plan-json` | Yes | | Path to Terraform plan JSON file (`terraform show -json <planfile>`) |
| `provider` | Yes | | AI provider: `openai`, `anthropic`, or `gemini` |
| `api-key` | Yes | | API key for the chosen provider |
| `model` | Yes | | Model name (e.g. `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-2.0-flash`) |
| `additional-instructions` | No | | Repository-specific context appended to the system prompt (see below) |
| `comment-on-pr` | No | `true` | Post the assessment as a PR comment |
| `github-token` | No | `GITHUB_TOKEN` | Token used for posting PR comments |

### Additional instructions

The default risk guidelines know nothing about your repository. `additional-instructions`
lets you tell the assessor which change patterns are expected and routine, so that
business-as-usual work is not rated as though it were a change to live infrastructure:

```yaml
- name: Assess Terraform Risk
  uses: liamjohnston/terraform-risk-assessor@V1
  with:
    plan-json: plan.json
    provider: gemini
    api-key: ${{ secrets.GEMINI_API_KEY }}
    model: gemini-3.1-pro-preview
    additional-instructions: |
      This repository is a GCP project factory. The routine change here is a new
      sandbox project: a create-only plan adding a project, its budget, a shared-VPC
      attachment and an owner binding scoped to that new project. Treat it as low.
      Anything touching an existing project, or any delete or replace, is not routine.
```

The text is fenced inside the system prompt and explicitly subordinated to the risk
guidelines: it can tell the model what is normal for your repository, but it cannot
change the response schema or stop the model reporting a change that destroys,
replaces or exposes existing infrastructure.

## Outputs

| Output | Description |
|--------|-------------|
| `risk-level` | Overall risk level: `critical`, `high`, `medium`, `low`, or `info` |
| `assessment` | Full risk assessment as markdown |

### Using outputs in subsequent steps

```yaml
- name: Assess Terraform Risk
  id: risk
  uses: liamjohnston/terraform-risk-accessor@v1.5.1
  with:
    plan-json: plan.json
    provider: openai
    api-key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-4o

- name: Fail on critical risk
  if: steps.risk.outputs.risk-level == 'critical'
  run: exit 1
```

## Risk levels

| Level | Meaning |
|-------|---------|
| **Critical** | Destruction of stateful resources, broad IAM changes, security groups opening `0.0.0.0/0`, removing encryption, deleting backups |
| **High** | Resource replacements (destroy + create), security resource modifications, networking changes, DNS/load balancer changes |
| **Medium** | In-place updates, scaling changes, configuration changes to compute instances |
| **Low** | Adding new resources, tag-only changes, restrictive security rule additions |
| **Info** | No-op changes, data source additions, cosmetic changes |

## PR comment

The action posts a formatted comment on the PR with a findings table sorted by severity. On subsequent runs it updates the existing comment rather than creating a new one.

## Supported providers

| Provider | Example models |
|----------|---------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o3-mini` |
| Anthropic | `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001` |
| Gemini | `gemini-2.0-flash`, `gemini-2.5-pro-preview-05-06` |

## License

MIT
