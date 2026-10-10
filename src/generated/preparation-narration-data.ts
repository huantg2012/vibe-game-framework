// AUTO-GENERATED from data/atmosphere-lines.csv + data/preparation-narration-pools.csv — DO NOT EDIT
// Prepared content only: no production selector or presentation hook imports this registry.
export type PreparationNarrationGrade = "low" | "medium" | "severe";
export type PreparationNarrationContext = "baseline" | "new_weapon" | "ready_item" | "body_growth" | "return_gain" | "return_loss" | "loss_new_weapon" | "worn_weapon";
export type PreparationNarrationPool = "prepare.baseline.low" | "prepare.baseline.medium" | "prepare.baseline.severe" | "prepare.new_weapon.low" | "prepare.new_weapon.medium" | "prepare.new_weapon.severe" | "prepare.ready_item" | "prepare.body_growth" | "prepare.return_gain" | "prepare.return_loss" | "prepare.loss_new_weapon" | "prepare.worn_weapon";
export interface PreparationNarrationLine { readonly id: string; readonly text: string }
export interface PreparationNarrationPoolDefinition { readonly grades: readonly PreparationNarrationGrade[]; readonly context: PreparationNarrationContext; readonly status: "prepared-only"; readonly lines: readonly PreparationNarrationLine[] }
export const PREPARATION_NARRATION_POOLS: Readonly<Record<PreparationNarrationPool, PreparationNarrationPoolDefinition>> = {
  "prepare.baseline.low": {
    "grades": [
      "low"
    ],
    "context": "baseline",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_low_01",
        "text": "我还没到要拿命换薪柴的时候。"
      },
      {
        "id": "prepare_low_02",
        "text": "我先走一小段。今天不急着逞能。"
      },
      {
        "id": "prepare_low_03",
        "text": "这一趟，我只想拿些薪柴回来。"
      },
      {
        "id": "prepare_low_04",
        "text": "我想慢一点走，不必每一步都像在逃。"
      },
      {
        "id": "prepare_low_05",
        "text": "我还想回来坐一会儿。就照这个念头走。"
      },
      {
        "id": "prepare_low_06",
        "text": "我松开咬着的牙。先这么走吧。"
      }
    ]
  },
  "prepare.baseline.medium": {
    "grades": [
      "medium"
    ],
    "context": "baseline",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_medium_01",
        "text": "我得留点力气，回来时没人拉我一把。"
      },
      {
        "id": "prepare_medium_02",
        "text": "我得把退路记牢。到时候未必顾得上找。"
      },
      {
        "id": "prepare_medium_03",
        "text": "我不想空手回来，也不想把自己留在那里。"
      },
      {
        "id": "prepare_medium_04",
        "text": "我的脚还肯往前。那就走走看。"
      },
      {
        "id": "prepare_medium_05",
        "text": "我答应过自己，该走就走。进去以后也得算数。"
      },
      {
        "id": "prepare_medium_06",
        "text": "我把下一步想好了。再远的，进去再说。"
      }
    ]
  },
  "prepare.baseline.severe": {
    "grades": [
      "severe"
    ],
    "context": "baseline",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_severe_01",
        "text": "我的腿不肯往前。它们比我明白。"
      },
      {
        "id": "prepare_severe_02",
        "text": "我还没抬脚，牙就咬紧了。"
      },
      {
        "id": "prepare_severe_03",
        "text": "我得先舍得松手。不然拿得越多，越不肯走。"
      },
      {
        "id": "prepare_severe_04",
        "text": "我不喜欢自己盯着里面的样子。还在盘算能拿多少。"
      },
      {
        "id": "prepare_severe_05",
        "text": "我想回头的念头来得这么早，最好别忘了它。"
      },
      {
        "id": "prepare_severe_06",
        "text": "我站在这里，还能说不去。"
      }
    ]
  },
  "prepare.new_weapon.low": {
    "grades": [
      "low"
    ],
    "context": "new_weapon",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_weapon_low_01",
        "text": "拿着它还只在外头转，我有点不甘心。"
      },
      {
        "id": "prepare_weapon_low_02",
        "text": "我换了家伙，脚却还想走省事的路。"
      },
      {
        "id": "prepare_weapon_low_03",
        "text": "我先找找手感。胆子可以晚点再长。"
      },
      {
        "id": "prepare_weapon_low_04",
        "text": "我想把它用上一回，又不愿专为这个惹事。"
      },
      {
        "id": "prepare_weapon_low_05",
        "text": "我带着它出来，总比把它放着好。"
      },
      {
        "id": "prepare_weapon_low_06",
        "text": "我一握住它，心里就又想往深处去了。"
      }
    ]
  },
  "prepare.new_weapon.medium": {
    "grades": [
      "medium"
    ],
    "context": "new_weapon",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_weapon_medium_01",
        "text": "这回，我想让挡路的先退。"
      },
      {
        "id": "prepare_weapon_medium_02",
        "text": "我想听听这根撬棍砸在东西上的声音。"
      },
      {
        "id": "prepare_weapon_medium_03",
        "text": "握着它站在这儿，我反倒不耐烦了。"
      },
      {
        "id": "prepare_weapon_medium_04",
        "text": "有它在手里，我连回头都想晚一点。"
      },
      {
        "id": "prepare_weapon_medium_05",
        "text": "我不想只掂着它猜。进去挥一下就知道了。"
      },
      {
        "id": "prepare_weapon_medium_06",
        "text": "我握住新的家伙，刚才那点犹豫就没那么要紧了。"
      }
    ]
  },
  "prepare.new_weapon.severe": {
    "grades": [
      "severe"
    ],
    "context": "new_weapon",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_weapon_severe_01",
        "text": "我知道不该只凭手里这根东西。可我还是想试。"
      },
      {
        "id": "prepare_weapon_severe_02",
        "text": "我才换了把撬棍，就开始打里面的主意了。"
      },
      {
        "id": "prepare_weapon_severe_03",
        "text": "我握着它，连那种地方也舍不得略过去。"
      },
      {
        "id": "prepare_weapon_severe_04",
        "text": "我想往前。手里的东西把这念头喂得太快了。"
      },
      {
        "id": "prepare_weapon_severe_05",
        "text": "我先握紧它。至于害怕，可以边走边怕。"
      },
      {
        "id": "prepare_weapon_severe_06",
        "text": "我知道回来的路不会替我变短。还是想试一趟。"
      }
    ]
  },
  "prepare.ready_item": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "ready_item",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_ready_01",
        "text": "带上这件新的，我想往深处试一趟。"
      },
      {
        "id": "prepare_ready_02",
        "text": "我得把它带上。留在这里，可帮不了我什么。"
      },
      {
        "id": "prepare_ready_03",
        "text": "我还没把它放进行装，已经在想怎么用了。"
      },
      {
        "id": "prepare_ready_04",
        "text": "我想给这件东西留个位置。"
      },
      {
        "id": "prepare_ready_05",
        "text": "我等到它能用了，总得带出去一回。"
      },
      {
        "id": "prepare_ready_06",
        "text": "我还没有带上它。胆子倒先借来了。"
      }
    ]
  },
  "prepare.body_growth": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "body_growth",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_growth_01",
        "text": "薪柴已经花在这副身子上了。我得试试值不值。"
      },
      {
        "id": "prepare_growth_02",
        "text": "这回，我想晚一点再逃。"
      },
      {
        "id": "prepare_growth_03",
        "text": "我总不能只在这里，猜自己能多撑多久。"
      },
      {
        "id": "prepare_growth_04",
        "text": "我肯往自己身上花这些，总该肯往前多走几步。"
      },
      {
        "id": "prepare_growth_05",
        "text": "我好不容易有了点长进，舍不得只拿来壮胆。"
      },
      {
        "id": "prepare_growth_06",
        "text": "我也想知道，这副身子还能把我带到哪儿。"
      }
    ]
  },
  "prepare.return_gain": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "return_gain",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_gain_01",
        "text": "上回带了东西回来，我又惦记起里面了。"
      },
      {
        "id": "prepare_gain_02",
        "text": "上回没白跑。我却已经嫌少了。"
      },
      {
        "id": "prepare_gain_03",
        "text": "我记得拿到东西时的痛快，倒把回头前的犹豫忘了些。"
      },
      {
        "id": "prepare_gain_04",
        "text": "我算着上回拿了多少，脚就又想往那边去。"
      },
      {
        "id": "prepare_gain_05",
        "text": "我本该知足一会儿。手却还想往包里装。"
      },
      {
        "id": "prepare_gain_06",
        "text": "我把上回的收获记得太清楚，什么都想再拿一份。"
      }
    ]
  },
  "prepare.return_loss": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "return_loss",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_loss_01",
        "text": "我丢下的东西够多了。这回先把脚下看清。"
      },
      {
        "id": "prepare_loss_02",
        "text": "我还记得丢了多少。这回不能只顾着拿。"
      },
      {
        "id": "prepare_loss_03",
        "text": "我不想再算一遍，自己把什么留在了里面。"
      },
      {
        "id": "prepare_loss_04",
        "text": "我一盘算多带点什么，就想起上回少了什么。"
      },
      {
        "id": "prepare_loss_05",
        "text": "我得把回头这件事，想在伸手前面。"
      },
      {
        "id": "prepare_loss_06",
        "text": "我还惦记着那些丢掉的东西。惦记也没法拿回来。"
      }
    ]
  },
  "prepare.loss_new_weapon": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "loss_new_weapon",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_loss_weapon_01",
        "text": "上回丢的东西还没忘。手里换了家伙，我又想进去了。"
      },
      {
        "id": "prepare_loss_weapon_02",
        "text": "我又把家伙握紧了。上回那口气，还没咽下去。"
      },
      {
        "id": "prepare_loss_weapon_03",
        "text": "我不想再丢一回。可这件新的，又让我想多拿一点。"
      },
      {
        "id": "prepare_loss_weapon_04",
        "text": "我本来想收敛些。换了家伙，这话就不太作数了。"
      },
      {
        "id": "prepare_loss_weapon_05",
        "text": "我把损失记得清清楚楚，还是替自己找到了再去的理由。"
      },
      {
        "id": "prepare_loss_weapon_06",
        "text": "我丢过东西，没丢掉那点贪心。手里一换，又冒出来了。"
      }
    ]
  },
  "prepare.worn_weapon": {
    "grades": [
      "low",
      "medium",
      "severe"
    ],
    "context": "worn_weapon",
    "status": "prepared-only",
    "lines": [
      {
        "id": "prepare_worn_01",
        "text": "这根撬棍经不起我乱用了。我得挑着出手。"
      },
      {
        "id": "prepare_worn_02",
        "text": "我不能把回程，也押在这根撬棍上。"
      },
      {
        "id": "prepare_worn_03",
        "text": "我得少挥几下。光攥紧它不顶用。"
      },
      {
        "id": "prepare_worn_04",
        "text": "我舍不得把它用坏，出手前得多看一眼。"
      },
      {
        "id": "prepare_worn_05",
        "text": "我先想着绕开。真要用它，留给躲不过的。"
      },
      {
        "id": "prepare_worn_06",
        "text": "我攥着它，就容易忘了它也会坏。"
      }
    ]
  }
};
