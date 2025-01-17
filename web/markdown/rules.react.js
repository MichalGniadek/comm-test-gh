// @flow

import _memoize from 'lodash/memoize.js';
import * as React from 'react';
import * as SimpleMarkdown from 'simple-markdown';

import * as SharedMarkdown from 'lib/shared/markdown.js';
import { chatMentionRegex } from 'lib/shared/mention-utils.js';
import type {
  RelativeMemberInfo,
  ThreadInfo,
  ChatMentionCandidates,
} from 'lib/types/thread-types.js';

import MarkdownChatMention from './markdown-chat-mention.react.js';
import MarkdownSpoiler from './markdown-spoiler.react.js';
import MarkdownUserMention from './markdown-user-mention.react.js';

export type MarkdownRules = {
  +simpleMarkdownRules: SharedMarkdown.ParserRules,
  +useDarkStyle: boolean,
};

const linkRules: boolean => MarkdownRules = _memoize(useDarkStyle => {
  const simpleMarkdownRules = {
    // We are using default simple-markdown rules
    // For more details, look at native/markdown/rules.react
    link: {
      ...SimpleMarkdown.defaultRules.link,
      match: () => null,
      // eslint-disable-next-line react/display-name
      react: (
        node: SharedMarkdown.SingleASTNode,
        output: SharedMarkdown.Output<SharedMarkdown.ReactElement>,
        state: SharedMarkdown.State,
      ) => (
        <a
          href={SimpleMarkdown.sanitizeUrl(node.target)}
          key={state.key}
          title={node.title}
          target="_blank"
          rel="noopener noreferrer"
        >
          {output(node.content, state)}
        </a>
      ),
    },
    paragraph: {
      ...SimpleMarkdown.defaultRules.paragraph,
      match: SimpleMarkdown.blockRegex(SharedMarkdown.paragraphRegex),
      // eslint-disable-next-line react/display-name
      react: (
        node: SharedMarkdown.SingleASTNode,
        output: SharedMarkdown.Output<SharedMarkdown.ReactElement>,
        state: SharedMarkdown.State,
      ) => (
        <React.Fragment key={state.key}>
          {output(node.content, state)}
        </React.Fragment>
      ),
    },
    text: SimpleMarkdown.defaultRules.text,
    url: {
      ...SimpleMarkdown.defaultRules.url,
      match: SimpleMarkdown.inlineRegex(SharedMarkdown.urlRegex),
    },
  };
  return {
    simpleMarkdownRules: simpleMarkdownRules,
    useDarkStyle,
  };
});

const markdownRules: boolean => MarkdownRules = _memoize(useDarkStyle => {
  const linkMarkdownRules = linkRules(useDarkStyle);

  const simpleMarkdownRules = {
    ...linkMarkdownRules.simpleMarkdownRules,
    autolink: SimpleMarkdown.defaultRules.autolink,
    link: {
      ...linkMarkdownRules.simpleMarkdownRules.link,
      match: SimpleMarkdown.defaultRules.link.match,
    },
    blockQuote: {
      ...SimpleMarkdown.defaultRules.blockQuote,
      // match end of blockQuote by either \n\n or end of string
      match: SharedMarkdown.matchBlockQuote(SharedMarkdown.blockQuoteRegex),
      parse: SharedMarkdown.parseBlockQuote,
    },
    spoiler: {
      order: SimpleMarkdown.defaultRules.paragraph.order - 1,
      match: SimpleMarkdown.inlineRegex(SharedMarkdown.spoilerRegex),
      parse(
        capture: SharedMarkdown.Capture,
        parse: SharedMarkdown.Parser,
        state: SharedMarkdown.State,
      ) {
        const content = capture[1];
        return {
          content: SimpleMarkdown.parseInline(parse, content, state),
        };
      },
      // eslint-disable-next-line react/display-name
      react: (
        node: SharedMarkdown.SingleASTNode,
        output: SharedMarkdown.Output<SharedMarkdown.ReactElement>,
        state: SharedMarkdown.State,
      ) => (
        <MarkdownSpoiler key={state.key} text={output(node.content, state)} />
      ),
    },
    inlineCode: SimpleMarkdown.defaultRules.inlineCode,
    em: SimpleMarkdown.defaultRules.em,
    strong: SimpleMarkdown.defaultRules.strong,
    del: SimpleMarkdown.defaultRules.del,
    u: SimpleMarkdown.defaultRules.u,
    heading: {
      ...SimpleMarkdown.defaultRules.heading,
      match: SimpleMarkdown.blockRegex(SharedMarkdown.headingRegex),
    },
    mailto: SimpleMarkdown.defaultRules.mailto,
    codeBlock: {
      ...SimpleMarkdown.defaultRules.codeBlock,
      match: SimpleMarkdown.blockRegex(SharedMarkdown.codeBlockRegex),
      parse: (capture: SharedMarkdown.Capture) => ({
        content: capture[0].replace(/^ {4}/gm, ''),
      }),
    },
    fence: {
      ...SimpleMarkdown.defaultRules.fence,
      match: SimpleMarkdown.blockRegex(SharedMarkdown.fenceRegex),
      parse: (capture: SharedMarkdown.Capture) => ({
        type: 'codeBlock',
        content: capture[2],
      }),
    },
    json: {
      order: SimpleMarkdown.defaultRules.paragraph.order - 1,
      match: (source: string, state: SharedMarkdown.State) => {
        if (state.inline) {
          return null;
        }
        return SharedMarkdown.jsonMatch(source);
      },
      parse: (capture: SharedMarkdown.Capture) => {
        const jsonCapture: SharedMarkdown.JSONCapture = (capture: any);
        return {
          type: 'codeBlock',
          content: SharedMarkdown.jsonPrint(jsonCapture),
        };
      },
    },
    list: {
      ...SimpleMarkdown.defaultRules.list,
      match: SharedMarkdown.matchList,
      parse: SharedMarkdown.parseList,
    },
    escape: SimpleMarkdown.defaultRules.escape,
  };
  return {
    ...linkMarkdownRules,
    simpleMarkdownRules,
    useDarkStyle,
  };
});

function useTextMessageRulesFunc(
  threadInfo: ThreadInfo,
  chatMentionCandidates: ChatMentionCandidates,
): boolean => MarkdownRules {
  const { members } = threadInfo;
  return React.useMemo(
    () =>
      _memoize<[boolean], MarkdownRules>((useDarkStyle: boolean) =>
        textMessageRules(members, chatMentionCandidates, useDarkStyle),
      ),
    [chatMentionCandidates, members],
  );
}

function textMessageRules(
  members: $ReadOnlyArray<RelativeMemberInfo>,
  chatMentionCandidates: ChatMentionCandidates,
  useDarkStyle: boolean,
): MarkdownRules {
  const baseRules = markdownRules(useDarkStyle);
  const membersMap = SharedMarkdown.createMemberMapForUserMentions(members);

  return {
    ...baseRules,
    simpleMarkdownRules: {
      ...baseRules.simpleMarkdownRules,
      userMention: {
        ...SimpleMarkdown.defaultRules.strong,
        match: SharedMarkdown.matchUserMentions(membersMap),
        parse: (capture: SharedMarkdown.Capture) =>
          SharedMarkdown.parseUserMentions(membersMap, capture),
        // eslint-disable-next-line react/display-name
        react: (
          node: SharedMarkdown.SingleASTNode,
          output: SharedMarkdown.Output<SharedMarkdown.ReactElement>,
          state: SharedMarkdown.State,
        ) => (
          <MarkdownUserMention
            key={state.key}
            text={node.content}
            userID={node.userID}
          />
        ),
      },
      chatMention: {
        ...SimpleMarkdown.defaultRules.strong,
        match: SimpleMarkdown.inlineRegex(chatMentionRegex),
        parse: (capture: SharedMarkdown.Capture) =>
          SharedMarkdown.parseChatMention(chatMentionCandidates, capture),
        // eslint-disable-next-line react/display-name
        react: (
          node: SharedMarkdown.SingleASTNode,
          output: SharedMarkdown.Output<SharedMarkdown.ReactElement>,
          state: SharedMarkdown.State,
        ) => (
          <MarkdownChatMention
            key={state.key}
            threadInfo={node.threadInfo}
            hasAccessToChat={node.hasAccessToChat}
            text={node.content}
          />
        ),
      },
    },
  };
}

let defaultTextMessageRules = null;

function getDefaultTextMessageRules(
  overrideDefaultChatMentionCandidates: ChatMentionCandidates = {},
): MarkdownRules {
  if (Object.keys(overrideDefaultChatMentionCandidates).length > 0) {
    return textMessageRules([], overrideDefaultChatMentionCandidates, false);
  }
  if (!defaultTextMessageRules) {
    defaultTextMessageRules = textMessageRules([], {}, false);
  }
  return defaultTextMessageRules;
}

export { linkRules, useTextMessageRulesFunc, getDefaultTextMessageRules };
