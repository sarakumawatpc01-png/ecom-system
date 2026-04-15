import { DeploymentStatus } from '../../config/deployment';

type TransitionMap = Record<DeploymentStatus, DeploymentStatus[]>;

const transitions: TransitionMap = {
  queued: ['running', 'failed'],
  running: ['success', 'failed', 'rolled_back'],
  success: ['rolled_back'],
  failed: ['rolled_back'],
  rolled_back: []
};

export const canTransitionStatus = (from: DeploymentStatus, to: DeploymentStatus) => transitions[from].includes(to);

export const assertStatusTransition = (from: DeploymentStatus, to: DeploymentStatus) => {
  if (!canTransitionStatus(from, to)) {
    throw new Error(`Invalid deployment status transition: ${from} -> ${to}`);
  }
};
