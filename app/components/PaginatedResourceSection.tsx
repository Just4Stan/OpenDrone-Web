import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

/**
 * <PaginatedResourceSection > is a component that encapsulate how the previous and next behaviors throughout your application.
 */
export function PaginatedResourceSection<NodesType>({
  connection,
  children,
  resourcesClassName,
}: {
  connection: React.ComponentProps<typeof Pagination<NodesType>>['connection'];
  children: (props: {node: NodesType; index: number}) => React.ReactNode;
  resourcesClassName?: string;
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        return (
          <div>
            <PreviousLink
              className="pagination-link"
              aria-busy={isLoading || undefined}
              data-pending={isLoading || undefined}
            >
              {isLoading ? (
                <>
                  <span className="inline-spinner" aria-hidden="true" /> Loading…
                </>
              ) : (
                <span>↑ Load previous</span>
              )}
            </PreviousLink>
            {resourcesClassName ? (
              <div className={resourcesClassName}>{resourcesMarkup}</div>
            ) : (
              resourcesMarkup
            )}
            <NextLink
              className="pagination-link"
              aria-busy={isLoading || undefined}
              data-pending={isLoading || undefined}
            >
              {isLoading ? (
                <>
                  <span className="inline-spinner" aria-hidden="true" /> Loading…
                </>
              ) : (
                <span>Load more ↓</span>
              )}
            </NextLink>
          </div>
        );
      }}
    </Pagination>
  );
}
