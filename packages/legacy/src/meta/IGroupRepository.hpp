#ifndef IGROUPREPOSITORY_H
#define IGROUPREPOSITORY_H
#pragma once

#include <vector>

#include "../lang/ILangResult.hpp"

using std::vector;

class IGroupRepository {
public:
  virtual vector<shared_ptr<ILangResult>>
  get_group_results(const string &group) = 0;
};
#endif