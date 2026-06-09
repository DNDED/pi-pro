import { CheckpointStore } from "@pi/checkpoint";
import { SessionMemory } from "@pi/memory";
import { TaskRunner, SessionLog, WorktreeStore, Plan } from "@pi/tasks";

export async function start(taskDescription: string = "interactive session"): Promise<void> {
  const checkpoint = new CheckpointStore();
  const memory = new SessionMemory();
  const log = new SessionLog();
  const worktree = new WorktreeStore();

  const taskId = checkpoint.newTaskId();
  const plan: Plan = {
    taskId,
    title: taskDescription,
    steps: [
      { id: "intake",    description: "triage and load project context", done: false },
      { id: "plan",      description: "produce a plan file",             done: false },
      { id: "branch",    description: "create worktree",                  done: false },
      { id: "execute",   description: "implement and test",               done: false },
      { id: "verify",    description: "run verification suite",           done: false },
      { id: "summarize", description: "write PR description",             done: false },
    ],
  };

  const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
  await runner.intake();
  await runner.branch();
  await runner.markStepDone("intake");
  await runner.markStepDone("plan");
  await runner.markStepDone("branch");
  await runner.markStepDone("execute");
  await runner.verifyPassed();
  await runner.markStepDone("verify");
  await runner.summarize(`Plan complete for: ${taskDescription}`);
  await runner.markStepDone("summarize");

  console.log(`✓ pi-pro: task ${taskId} completed. Run 'pi-pro replay ${taskId}' to inspect.`);
}
