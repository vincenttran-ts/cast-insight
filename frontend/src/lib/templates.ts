import type { FlowStep } from '@/types'

export interface FlowTemplate {
  id: string
  name: string
  taskGoal: string
  evaluationBrief?: string
  steps: Omit<FlowStep, 'id'>[]
}

/**
 * Pre-baked Casting Networks Talent workflow templates. Steps are
 * pre-populated; designers drop their own screenshots into each slot
 * (the placeholder text in the canvas marks where mockups belong).
 */
export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'workflow-alpha',
    name: 'Workflow Alpha: Submit self-tape audition for network episodic booking',
    taskGoal:
      'As a talent, submit a self-tape audition for a network episodic role before the casting deadline, and be confident the tape (video + audio) was fully received by casting.',
    evaluationBrief:
      'Focus on upload/processing feedback, confirmation states, and submission workflow clarity. Ignore seed data in role lists or applicant tables.',
    steps: [
      { text: "Open the role details page for the network episodic breakdown and tap 'Submit Self-Tape'." },
      { text: 'Choose the self-tape video file from the device and start the upload.' },
      {
        text: 'Wait on the upload/processing screen until the video shows a completed processing state, including the audio sync indicator.',
        designNotes: 'Evaluate processing-state clarity (spinner vs progress vs phase labels), not file metadata.',
      },
      { text: 'Authorize Media Profile Token use for this premium submission when the pricing prompt appears.' },
      { text: 'Review the submission summary (role, tape thumbnail, sides version) and tap the final Submit button.' },
      {
        text: 'Land on the confirmation state and verify casting has received the self-tape submission.',
        designNotes: 'Focus on receipt-style confirmation copy and next-step clarity.',
      },
    ],
  },
  {
    id: 'workflow-beta',
    name: 'Workflow Beta: Add new updated theatrical headshot and recalculate global profile dimensions',
    taskGoal:
      'As a talent, replace the primary theatrical headshot with a newly shot one, confirm the crop, and trigger the global profile dimension recalculation so all casting-facing views show the new image correctly.',
    evaluationBrief:
      'Focus on crop/preview tooling, primary-image replacement warnings, and recalculation feedback. Ignore seed profile names or table row content.',
    steps: [
      { text: "Navigate to Profile > Media and locate the current primary theatrical headshot slot, then tap 'Update Headshot'." },
      { text: 'Select the new headshot file and begin the upload.' },
      {
        text: 'Use the crop/framing tool to set the theatrical crop and confirm the preview across thumbnail sizes.',
        designNotes: 'Evaluate crop tool affordances and preview sizing on mobile, not image dimensions in seed data.',
      },
      { text: "Set the new image as 'Primary Theatrical' and acknowledge the warning about replacing the existing primary." },
      { text: "Trigger 'Recalculate Global Profile Dimensions' and wait for the processing state to complete." },
      { text: 'Verify the profile preview shows the new headshot in search results, submission cards, and the public profile view.' },
    ],
  },
]
