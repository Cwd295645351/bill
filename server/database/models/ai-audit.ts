import { DataTypes } from 'sequelize'
import { defineId, type DefineModel } from './helpers'

/** AI 调用可检索审计 */
export function defineAiAuditModels(defineModel: DefineModel) {
  const AiCallAudit = defineModel(
    'ai_call_audits',
    {
      id: defineId,
      userId: { type: DataTypes.CHAR(36), allowNull: false, field: 'user_id' },
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      capability: { type: DataTypes.STRING(64), allowNull: false },
      upstreamRequested: { type: DataTypes.BOOLEAN, allowNull: false, field: 'upstream_requested' },
      outcome: { type: DataTypes.STRING(16), allowNull: false },
      errorCategory: { type: DataTypes.STRING(64), allowNull: false, field: 'error_category' },
      durationMs: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_ms' },
      promptTokens: { type: DataTypes.INTEGER, allowNull: true, field: 'prompt_tokens' },
      completionTokens: { type: DataTypes.INTEGER, allowNull: true, field: 'completion_tokens' },
      totalTokens: { type: DataTypes.INTEGER, allowNull: true, field: 'total_tokens' },
      dailyCount: { type: DataTypes.INTEGER, allowNull: true, field: 'daily_count' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' }
    },
    {
      tableName: 'ai_call_audits',
      indexes: [
        { fields: ['created_at'], name: 'idx_ai_call_audits_created_at' },
        { fields: ['user_id', 'created_at'], name: 'idx_ai_call_audits_user_created' },
        { fields: ['bill_id', 'created_at'], name: 'idx_ai_call_audits_bill_created' },
        { fields: ['outcome', 'created_at'], name: 'idx_ai_call_audits_outcome_created' }
      ]
    }
  )

  return { AiCallAudit }
}
