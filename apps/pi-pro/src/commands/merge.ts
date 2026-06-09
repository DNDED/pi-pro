export async function merge(taskId: string): Promise<void> {
  console.log(`pi-pro merge ${taskId}: stub — in v1 this rebases and runs 'gh pr create'.`);
  console.log(`Worktree: .pi-pro/worktrees/${taskId}`);
  console.log(`Branch:   pi-pro/${taskId.replace(/^tsk_/, "")}`);
}
