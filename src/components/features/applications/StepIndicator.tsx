'use client'

import { CheckCircle, Edit, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

interface StepIndicatorProps {
  currentStep: 'form' | 'preview'
  className?: string
}

const steps: Step[] = [
  {
    id: 'form',
    title: '填写申请',
    description: '填写申请表单信息',
    icon: <Edit className="h-5 w-5" />
  },
  {
    id: 'preview',
    title: '确认信息',
    description: '预览并确认申请内容',
    icon: <FileText className="h-5 w-5" />
  }
]

export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep)
  }

  const currentStepIndex = getCurrentStepIndex()

  return (
    <div className={cn('w-full', className)}>
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, stepIndex) => {
            const isCompleted = stepIndex < currentStepIndex
            const isCurrent = stepIndex === currentStepIndex
            const isUpcoming = stepIndex > currentStepIndex

            return (
              <li
                key={step.id}
                className={cn(
                  'relative',
                  stepIndex !== steps.length - 1 ? 'flex-1' : ''
                )}
              >
                <div className="flex items-center">
                  {/* Step circle */}
                  <div className="flex items-center">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border-2',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        isCurrent && 'border-primary bg-background text-primary',
                        isUpcoming && 'border-muted bg-background text-muted-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        step.icon
                      )}
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="ml-4 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isCompleted && 'text-primary',
                        isCurrent && 'text-primary',
                        isUpcoming && 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </p>
                    <p
                      className={cn(
                        'text-sm',
                        isCompleted && 'text-muted-foreground',
                        isCurrent && 'text-muted-foreground',
                        isUpcoming && 'text-muted-foreground'
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                {stepIndex !== steps.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-5 top-10 h-0.5 w-full',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}