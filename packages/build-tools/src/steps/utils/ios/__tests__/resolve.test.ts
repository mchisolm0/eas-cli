import { IOSConfig } from '@expo/config-plugins';

import { resolveSignableTargetNamesAsync } from '../resolve';

describe(resolveSignableTargetNamesAsync, () => {
  it('returns the application target and its nested signable dependencies', async () => {
    const { TargetType } = IOSConfig.Target;
    jest.spyOn(IOSConfig.Target, 'findApplicationTargetWithDependenciesAsync').mockResolvedValue({
      name: 'app',
      type: TargetType.APPLICATION,
      signable: true,
      dependencies: [
        { name: 'SomeFramework', type: TargetType.FRAMEWORK, signable: false },
        {
          name: 'watch',
          type: TargetType.WATCH,
          signable: true,
          dependencies: [{ name: 'watch-extension', type: TargetType.EXTENSION, signable: true }],
        },
      ],
    });

    await expect(resolveSignableTargetNamesAsync('/app', 'app')).resolves.toEqual([
      'app',
      'watch',
      'watch-extension',
    ]);
    expect(IOSConfig.Target.findApplicationTargetWithDependenciesAsync).toHaveBeenCalledWith(
      '/app',
      'app'
    );
  });
});
