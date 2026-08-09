const mockAiConfig = {
  enabled: true,
  models: { moodAnalysis: 'deepseek-default' },
};

jest.mock('../../../src/config/aiConfig', () => ({
  __esModule: true,
  default: mockAiConfig,
}));
jest.mock('../../../src/services/fastApiClient', () => ({
  callChatCompletionRequest: jest.fn(),
}));
jest.mock('../../../src/services/userProfileService', () => ({
  getUserProfile: jest.fn(),
  profileToPromptText: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

import * as aiClientExports from '../../../src/utils/ai/aiClient';
import { callChatCompletionRequest } from '../../../src/services/fastApiClient';
import { getUserProfile, profileToPromptText, UserProfile } from '../../../src/services/userProfileService';
import logger from '../../../src/utils/logger';

const mockedRequest = jest.mocked(callChatCompletionRequest);
const mockedGetUserProfile = jest.mocked(getUserProfile);
const mockedProfileToPromptText = jest.mocked(profileToPromptText);

const profile: UserProfile = {
  moodBaseline: 'steady',
  moodTrend: 'stable',
  recentAssessment: 'none',
  keyEvents: [],
  preferredStyle: 'warm',
  dominantMood: 'calm',
  moodCount: 3,
  updatedAt: '2026-08-09T00:00:00.000Z',
};

describe('callChatCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAiConfig.enabled = true;
    mockedGetUserProfile.mockResolvedValue(null);
    mockedProfileToPromptText.mockReturnValue('');
  });

  it('preserves the exact default request contract and trims returned content', async () => {
    mockedRequest.mockResolvedValue({ content: '  OK  ', model: 'deepseek-default' });
    const messages = [{ role: 'user' as const, content: 'hello' }];

    await expect(aiClientExports.callChatCompletion(messages)).resolves.toBe('OK');

    expect(mockedRequest).toHaveBeenCalledWith({
      messages,
      model: 'deepseek-default',
      temperature: 0.7,
      maxTokens: 2048,
    });
  });

  it('preserves explicit chat options', async () => {
    mockedRequest.mockResolvedValue({ content: 'answer', model: 'custom-model' });

    await aiClientExports.callChatCompletion(
      [{ role: 'user', content: 'hello' }],
      { model: 'custom-model', temperature: 0, maxTokens: 64 }
    );

    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({
      model: 'custom-model',
      temperature: 0,
      maxTokens: 64,
    }));
  });

  it.each([{ content: '' }, { content: '   ' }, { content: undefined }])(
    'rejects a missing or blank response with a safe error: %p',
    async ({ content }) => {
      mockedRequest.mockResolvedValue({ content, model: 'deepseek-default' } as never);

      await expect(
        aiClientExports.callChatCompletion([{ role: 'user', content: 'hello' }])
      ).rejects.toThrow('AI 返回空内容');
    }
  );

  it('fails fast while disabled without sending a request', async () => {
    mockAiConfig.enabled = false;

    await expect(
      aiClientExports.callChatCompletion([{ role: 'user', content: 'hello' }])
    ).rejects.toThrow('AI 服务未启用');

    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('appends a converted profile to an existing system message', async () => {
    mockedGetUserProfile.mockResolvedValue(profile);
    mockedProfileToPromptText.mockReturnValue('PROFILE');
    mockedRequest.mockResolvedValue({ content: 'answer', model: 'deepseek-default' });

    await aiClientExports.callChatCompletion(
      [
        { role: 'system', content: 'BASE' },
        { role: 'user', content: 'hello' },
      ],
      { userId: 7, injectProfile: true }
    );

    expect(mockedGetUserProfile).toHaveBeenCalledWith(7);
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: 'system', content: 'BASE\n\nPROFILE' },
        { role: 'user', content: 'hello' },
      ],
    }));
  });

  it('prepends a system message when a converted profile has no existing target', async () => {
    mockedGetUserProfile.mockResolvedValue(profile);
    mockedProfileToPromptText.mockReturnValue('PROFILE');
    mockedRequest.mockResolvedValue({ content: 'answer', model: 'deepseek-default' });

    await aiClientExports.callChatCompletion(
      [{ role: 'user', content: 'hello' }],
      { userId: 7, injectProfile: true }
    );

    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: 'system', content: 'PROFILE' },
        { role: 'user', content: 'hello' },
      ],
    }));
  });

  it('continues without profile data when lookup fails and logs no private error', async () => {
    mockedGetUserProfile.mockRejectedValue(new Error('PRIVATE PROFILE DETAIL'));
    mockedRequest.mockResolvedValue({ content: 'answer', model: 'deepseek-default' });
    const messages = [{ role: 'user' as const, content: 'hello' }];

    await expect(
      aiClientExports.callChatCompletion(messages, { userId: 7, injectProfile: true })
    ).resolves.toBe('answer');

    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({ messages }));
    expect(logger.warn).toHaveBeenCalledWith('用户画像注入失败，继续正常调用');
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain('PRIVATE PROFILE DETAIL');
  });

  it('continues without profile data when profile conversion fails', async () => {
    mockedGetUserProfile.mockResolvedValue(profile);
    mockedProfileToPromptText.mockImplementation(() => {
      throw new Error('PRIVATE CONVERSION DETAIL');
    });
    mockedRequest.mockResolvedValue({ content: 'answer', model: 'deepseek-default' });
    const messages = [{ role: 'user' as const, content: 'hello' }];

    await expect(
      aiClientExports.callChatCompletion(messages, { userId: 7, injectProfile: true })
    ).resolves.toBe('answer');

    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({ messages }));
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain('PRIVATE CONVERSION DETAIL');
  });

  it('exports only the compatibility facade, not the legacy class or singleton', () => {
    expect(aiClientExports).toHaveProperty('callChatCompletion');
    expect(aiClientExports).not.toHaveProperty('AIClient');
    expect(aiClientExports).not.toHaveProperty('default');
  });
});
