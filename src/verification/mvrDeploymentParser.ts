import { Transaction } from '@mysten/sui/transactions';

export type DeploymentKind = 'publish' | 'upgrade';

interface PublishCommand {
  $kind: 'Publish';
  Publish: {
    modules: string[];
    dependencies: string[];
  };
}

interface UpgradeCommand {
  $kind: 'Upgrade';
  Upgrade: {
    modules: string[];
    dependencies: string[];
    package: string;
  };
}

type DeploymentCommand = PublishCommand | UpgradeCommand;

export interface DeploymentContext {
  kind: DeploymentKind;
  commandIndex: number;
  modules: string[];
  dependencies: string[];
  upgradePackageId?: string;
}

const isPublishCommand = (command: {
  $kind?: string;
  Publish?: unknown;
}): command is PublishCommand => {
  if (command.$kind !== 'Publish' || !command.Publish) return false;
  const publish = command.Publish as Partial<PublishCommand['Publish']>;
  return Array.isArray(publish.modules) && Array.isArray(publish.dependencies);
};

const isUpgradeCommand = (command: {
  $kind?: string;
  Upgrade?: unknown;
}): command is UpgradeCommand => {
  if (command.$kind !== 'Upgrade' || !command.Upgrade) return false;
  const upgrade = command.Upgrade as Partial<UpgradeCommand['Upgrade']>;
  return (
    Array.isArray(upgrade.modules) &&
    Array.isArray(upgrade.dependencies) &&
    typeof upgrade.package === 'string'
  );
};

const toDeploymentContext = (
  command: DeploymentCommand,
  commandIndex: number,
): DeploymentContext => {
  if (command.$kind === 'Publish') {
    return {
      kind: 'publish',
      commandIndex,
      modules: command.Publish.modules,
      dependencies: command.Publish.dependencies,
    };
  }

  return {
    kind: 'upgrade',
    commandIndex,
    modules: command.Upgrade.modules,
    dependencies: command.Upgrade.dependencies,
    upgradePackageId: command.Upgrade.package,
  };
};

export const parseDeploymentContext = (
  commands: readonly ({
    $kind?: string;
    Publish?: unknown;
    Upgrade?: unknown;
  })[],
): DeploymentContext => {
  const deploymentCommands = commands.flatMap((command, commandIndex) => {
    if (isPublishCommand(command) || isUpgradeCommand(command)) {
      return [toDeploymentContext(command, commandIndex)];
    }

    return [];
  });

  if (deploymentCommands.length === 0) {
    throw new Error('No Publish or Upgrade command found in transaction');
  }

  if (deploymentCommands.length > 1) {
    throw new Error(
      'Ambiguous deployment transaction: multiple Publish/Upgrade commands found',
    );
  }

  return deploymentCommands[0];
};

export const parseDeploymentContextFromBytes = (
  rawTransactionBytes: Uint8Array,
): DeploymentContext => {
  const transaction = Transaction.from(rawTransactionBytes);
  const data = transaction.getData();

  return parseDeploymentContext(data.commands);
};
