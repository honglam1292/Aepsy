// API URL: https://api-dev.aepsy.com/graphql

export const SEARCH_PROVIDERS = gql`
    query SEARCH_PROVIDERS($pageNum: Int!, $pageSize: Int!, $rawDisorders: [String!]) {
        searchProviders(
            input: {
                clientTypes: []
                languages: []
                providerAreas: []
                chapterType: INDIVIDUAL
                rawDisorders: $rawDisorders
            }
        ) {
            id
            providers(pageSize: $pageSize, pageNum: $pageNum) {
                canLoadMore
                totalSize
                providers {
                    userInfo {
                        firebaseUid
                        avatar
                    }
                    userName {
                        firstName
                        lastName
                    }
                    profile {
                        providerInfo {
                            yearExperience
                            providerTitle
                        }
                        providerTagInfo {
                            tags {
                                type
                                subType
                                text
                            }
                        }
                    }
                }
            }
        }
    }
`;
