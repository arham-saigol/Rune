import { Command } from 'commander';
import { fullSetup } from './setup';
import { setupApi } from './setup-api';
import { setupDiscord } from './setup-discord';
import { startService, restartService, stopService } from './service';

const program = new Command();
program.name('rune').description('Rune CLI').version('1.0.0');

program
  .command('setup')
  .description('Full setup wizard')
  .action(fullSetup);

program
  .command('setup api')
  .description('Re-configure API keys')
  .action(setupApi);

program
  .command('setup discord')
  .description('Re-configure Discord settings')
  .action(setupDiscord);

program
  .command('start')
  .description('Start the gateway service')
  .action(startService);

program
  .command('restart')
  .description('Restart the gateway service')
  .action(restartService);

program
  .command('stop')
  .description('Stop the gateway service')
  .action(stopService);

program.parse();
