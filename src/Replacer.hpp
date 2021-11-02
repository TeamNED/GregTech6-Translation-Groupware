#ifndef REPLACER_H
#define REPLACER_H
#pragma once

#include <exception>
#include <map>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "generator/DictGenerator.hpp"
#include "generator/Generator.hpp"
#include "generator/Rule.hpp"
#include "generator/RuleGenerator.hpp"
#include "meta/GeneratorMeta.hpp"
#include "meta/IGroupRepository.hpp"

using std::map;

class Replacer : public virtual IGroupRepository {

private:
  const vector<shared_ptr<Generator>> &_generators;
  std::unordered_map<shared_ptr<Generator>, vector<shared_ptr<ILangResult>>>
      _result_cache;
  std::unordered_map<string, vector<shared_ptr<ILangResult>>> _group_cache;

  vector<shared_ptr<ILangResult>>
  _get_generator_results(shared_ptr<Generator> gen);

public:
  Replacer(const vector<shared_ptr<Generator>> &generators);
  map<string, vector<std::pair<string, string>>> generate_map();
  vector<shared_ptr<ILangResult>> generate();
  virtual vector<shared_ptr<ILangResult>>
  get_group_results(const string &group) override;
};
#endif