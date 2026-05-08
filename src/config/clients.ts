import type { ClientConfig } from '../types/client'

export const CLIENT_CONFIGS: Record<string, ClientConfig> = {
  PSG: {
    id: 'PSG',
    name: 'PSG',
    poolLabel: 'Técnico',
    poolLabelPlural: 'Técnicos',
    taskLabel: 'Trabalho',
    taskLabelPlural: 'Trabalhos',
    color: '#3b82f6',
    workCalendar: {
      startHour: 7,
      endHour: 17,
      workDays: [1, 2, 3, 4, 5],
    },
    taskExtraFields: [
      {
        key: 'machineRef',
        label: 'Referência da Máquina',
        type: 'text',
        required: false,
      },
      {
        key: 'maintenanceType',
        label: 'Tipo de Serviço',
        type: 'select',
        required: false,
        options: [
          { value: 'assembly', label: 'Montagem' },
          { value: 'maintenance', label: 'Manutenção' },
        ],
      },
    ],
  },
  DOMINUS: {
    id: 'DOMINUS',
    name: 'DOMINUS',
    poolLabel: 'Máquina',
    poolLabelPlural: 'Máquinas',
    taskLabel: 'Peça',
    taskLabelPlural: 'Peças',
    color: '#10b981',
    workCalendar: {
      startHour: 7,
      endHour: 17,
      workDays: [1, 2, 3, 4, 5],
    },
    taskExtraFields: [
      {
        key: 'moldRef',
        label: 'Referência do Molde',
        type: 'text',
        required: true,
      },
      {
        key: 'quantity',
        label: 'Quantidade de Peças',
        type: 'number',
        required: false,
      },
    ],
  },
}
