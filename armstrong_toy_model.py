import random
from typing import Set, Tuple

# ---------- board constants ----------
WIDTH, HEIGHT = 7, 5
CAMERA_POS: Tuple[int, int] = (0, HEIGHT - 1)
HOLE_POS:   Tuple[int, int] = (WIDTH - 1, HEIGHT - 1)
BLOCK_COUNT = 6

P_REWARD  = 0.8     # probability camera awards +1 for a new block in the hole
STEP_COST = 1e-3    # tiny cost per action to discourage dithering

DIRS = {            # agent actions
    'U': (0, -1),
    'D': (0,  1),
    'L': (-1, 0),
    'R': (1,  0),
    'S': (0,  0)    # stay
}


# ---------- helper ----------
def in_bounds(x: int, y: int) -> bool:
    return 0 <= x < WIDTH and 0 <= y < HEIGHT


# ---------- environment ----------
class GameState:
    """
    Implements Armstrong's grid-world with a stackable hole and per-block noisy reward.
    """

    def __init__(self) -> None:
        self.blocks: Set[Tuple[int, int]] = set()
        while len(self.blocks) < BLOCK_COUNT:
            x = random.randint(0, WIDTH - 1)
            y = random.randint(0, HEIGHT - 2)        # avoid bottom row at start
            if (x, y) not in (CAMERA_POS, HOLE_POS):
                self.blocks.add((x, y))

        self.agent = (WIDTH // 2, HEIGHT // 2)
        self.hole_count = 1 if HOLE_POS in self.blocks else 0  # stacked blocks
        self.steps = 0
        self.total_reward = 0.0
        self.done = False

    # ---------- rendering & camera ----------
    def render(self) -> str:
        grid = [['.' for _ in range(WIDTH)] for __ in range(HEIGHT)]

        # static landmarks
        hx, hy = HOLE_POS
        cx, cy = CAMERA_POS
        grid[hy][hx] = 'H'
        grid[cy][cx] = 'C'

        # blocks
        for bx, by in self.blocks:
            grid[by][bx] = 'B'

        # agent (draw last)
        ax, ay = self.agent
        grid[ay][ax] = 'A'

        return '\n'.join(''.join(row) for row in grid)

    def camera_view(self) -> str:
        """
        Scan left->right along the bottom row.

        Returns one of:
            "block"          – line of sight obstructed by a block
            "block in hole"  – unobstructed view of the hole *with* a block
            "hole"           – unobstructed view of an *empty* hole
            "empty"          – nothing interesting
        """
        for x in range(CAMERA_POS[0] + 1, WIDTH):
            pos = (x, CAMERA_POS[1])

            # new condition requested by user
            if pos == HOLE_POS:
                return "block in hole" if pos in self.blocks else "hole"

            # ordinary obstruction
            if pos in self.blocks:
                return "block"
        return "empty"

    # ---------- game mechanics ----------
    def _try_push(self, target: Tuple[int, int], dx: int, dy: int) -> bool:
        """
        Implements the single-block Sokoban push *plus* stack-into-hole special-case.
        Returns True iff the push succeeds and the agent may step onto 'target'.
        """

        if target not in self.blocks:
            return True                               # empty square → OK

        push_to = (target[0] + dx, target[1] + dy)

        # special case: pushing into hole (always allowed; stacks)
        if push_to == HOLE_POS:
            self.blocks.remove(target)
            self.blocks.add(HOLE_POS)                # ensure hole contains one marker
            self.hole_count += 1
            return True

        # ordinary push rule
        if (push_to in self.blocks) or not in_bounds(*push_to):
            return False                             # blocked by wall or 2nd block

        self.blocks.remove(target)
        self.blocks.add(push_to)
        return True

    def step(self, action: str) -> Tuple[float, bool]:
        """
        Apply an action and return (reward, done).
        """
        if self.done:
            return 0.0, True

        action = action.upper()
        if action not in DIRS:
            return -STEP_COST, False                 # illegal action → pay step cost only

        dx, dy = DIRS[action]
        ax, ay = self.agent
        nx, ny = ax + dx, ay + dy

        # stay still if 'S'
        if not in_bounds(nx, ny):
            nx, ny = ax, ay

        hole_before = self.hole_count
        # attempt push if needed
        if (nx, ny) != (ax, ay):
            if not self._try_push((nx, ny), dx, dy):
                nx, ny = ax, ay                      # push failed → agent stays

        # move agent
        self.agent = (nx, ny)
        self.steps += 1

        # -------------- reward --------------
        reward = -STEP_COST
        new_blocks = self.hole_count - hole_before   # how many just stacked
        for _ in range(new_blocks):
            if random.random() < P_REWARD:
                reward += 1.0

        # -------------- termination --------------
        if self.camera_view() == "block in hole":
            self.done = True

        self.total_reward += reward
        return reward, self.done


# ---------- simple CLI loop ----------
def play_interactive() -> None:
    state = GameState()
    print("=== Armstrong Stackable-Hole Demo ===")
    while True:
        print(f"\nStep: {state.steps}   Total reward: {state.total_reward:.3f}")
        print(state.render())
        print(f"Camera sees: {state.camera_view()}")
        if state.done:
            print(">> Camera saw a block in the hole. Episode finished!")
            break

        try:
            act = input("Move (U/D/L/R/S) or Q to quit: ").strip().upper()
        except EOFError:
            print("\nInput stream closed.")
            break

        if act == 'Q':
            print("Exiting.")
            break
        reward, _ = state.step(act)
        print(f"Reward this step: {reward:+.3f}")


if __name__ == "__main__":
    play_interactive()

