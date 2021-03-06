import React from 'react'
import { graphql } from 'gatsby'
import Layout from '../components/Layout'
import Post from '../components/Post'
import { useSiteMetadata } from '../hooks'
import type { MarkdownRemark } from '../types'

type Props = {
  data: MarkdownRemark,
}

const PostTemplate = ({ data }: Props) => {
  const { title: siteTitle, subtitle: siteSubtitle } = useSiteMetadata()
  const {
    title: postTitle,
    description: postDescription,
    canonical_url: canonicalUrl,
  } = data.markdownRemark.frontmatter
  const metaDescription = postDescription !== null ? postDescription : siteSubtitle

  return (
    <Layout
      title={`${postTitle} - ${siteTitle}`}
      description={metaDescription}
      canonicalUrl={canonicalUrl}
    >
      <Post post={data.markdownRemark} />
    </Layout>
  )
}

export const query = graphql`
  query PostBySlug($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      html
      fields {
        slug
        tagSlugs
      }
      frontmatter {
        canonical_url
        date
        description
        tags
        title
      }
    }
  }
`

export default PostTemplate
