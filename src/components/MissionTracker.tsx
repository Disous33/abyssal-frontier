import React from 'react';
import { CheckCircle2, Flag } from 'lucide-react';
import { CampaignMission, MissionState } from '../sim/types';

interface MissionTrackerProps {
  mission: MissionState;
  activeCampaignMission?: CampaignMission | null;
}

export const MissionTracker: React.FC<MissionTrackerProps> = ({
  mission,
  activeCampaignMission,
}) => {
  if (activeCampaignMission) {
    const completed = activeCampaignMission.status === 'completed';
    const doneWps = activeCampaignMission.waypoints.filter((w) => w.completed).length;
    const totalWps = Math.max(1, activeCampaignMission.waypoints.length);

    return (
      <div className="mt-2 bg-[#071520]/88 border border-amber-500/50 rounded-lg px-3 py-2 max-w-[310px] shadow-md pointer-events-none">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
            {completed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Flag className="w-3 h-3" />
            )}
            {activeCampaignMission.title}
          </span>
          <span className="font-mono-tabular text-[10px] text-slate-400">
            {doneWps}/{totalWps}
          </span>
        </div>
        <div className="text-xs font-medium text-slate-100 leading-snug">
          {activeCampaignMission.objectiveText}
        </div>
        <div className="mt-1 text-[10px] text-amber-300/90 font-mono-tabular">
          Recompensa: +{activeCampaignMission.rewardCredits} CR · Tecla J Diário
        </div>
      </div>
    );
  }

  const completed = mission.step === 'completed';

  return (
    <div className="mt-2 bg-[#071520]/88 border border-slate-700/65 rounded-lg px-3 py-2 max-w-[300px] shadow-md pointer-events-none">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
          {completed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Flag className="w-3 h-3" />
          )}
          {mission.title}
        </span>
        <span className="font-mono-tabular text-[10px] text-slate-400">
          {mission.stepIndex}/{mission.totalSteps}
        </span>
      </div>
      <div className="text-xs font-medium text-slate-100 leading-snug">
        {mission.objectiveText}
      </div>
      <div className="mt-1 text-[10px] text-slate-400 leading-snug">
        {mission.hintText}
      </div>
    </div>
  );
};
